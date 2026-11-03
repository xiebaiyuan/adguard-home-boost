import { createServer } from 'http'
import type { Server } from 'http'
import { describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'

interface Upstream {
  port: number
  requests: string[]
  close: () => void
}

const OLDEST = new Date(Date.now() - 2 * 864e5).toISOString()

const querylogEntry = (name: string, elapsedMs: string, cached: boolean) => ({
  time: new Date().toISOString(),
  question: { name, type: 'A' },
  elapsedMs,
  cached,
  upstream: cached ? '' : 'tls://dns.quad9.net',
  status: 'NOERROR',
  client: '192.168.1.100',
  client_info: { name: 'pc' },
})

const STATS_PAYLOAD = {
  top_queried_domains: [],
  top_clients: [],
  top_blocked_domains: [],
  top_upstreams_responses: [],
  top_upstreams_avg_time: [],
  dns_queries: [],
  blocked_filtering: [],
  num_dns_queries: 0,
  num_blocked_filtering: 0,
  num_replaced_safebrowsing: 0,
  num_replaced_safesearch: 0,
  num_replaced_parental: 0,
  avg_processing_time: 0,
  time_units: 'days',
}

async function startUpstream(opts: { entries?: unknown[]; delayMs?: number } = {}): Promise<Upstream> {
  const requests: string[] = []
  const server: Server = createServer(async (req, res) => {
    requests.push(`${req.method} ${req.url}`)
    if (req.url?.startsWith('/control/querylog')) {
      if (opts.delayMs) await new Promise(r => setTimeout(r, opts.delayMs))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ oldest: OLDEST, data: opts.entries ?? [] }))
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(req.url?.startsWith('/control/stats') ? JSON.stringify(STATS_PAYLOAD) : '{}')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
  return {
    port: (server.address() as any).port,
    requests,
    close: () => server.close(),
  }
}

interface ConfigOverrides {
  username?: string
  password?: string
  rejectUnauthorized?: boolean
  timeRangeHours?: number
}

function postConfig(app: FastifyInstance, baseUrl: string, over: ConfigOverrides = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/config',
    payload: {
      adguardConfig: {
        baseUrl,
        username: 'u',
        password: 'p',
        rejectUnauthorized: true,
        ...over,
      },
    },
  })
}

async function summary(app: FastifyInstance) {
  return JSON.parse((await app.inject({ method: 'GET', url: '/api/analysis/summary' })).body)
}

async function dashboard(app: FastifyInstance) {
  return JSON.parse((await app.inject({ method: 'GET', url: '/api/analysis/dashboard' })).body)
}

async function waitReady(app: FastifyInstance, expectReady: boolean, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  let last = await summary(app)
  while (Date.now() < deadline) {
    if (last.ready === expectReady) return last
    await new Promise(r => setTimeout(r, 50))
    last = await summary(app)
  }
  return last
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('C7 全局聚合来自全量延时分布', () => {
  it('两域探针：all 与 uncached 的 count/avg/p50/p95 都不同，且 13 个字段无假 0', async () => {
    const upstream = await startUpstream({
      entries: [
        querylogEntry('a.example.com', '100', false),
        querylogEntry('a.example.com', '200', false),
        querylogEntry('b.example.com', '10', false),
        querylogEntry('b.example.com', '0', true),
        querylogEntry('b.example.com', '0', true),
        querylogEntry('b.example.com', '0', true),
      ],
    })
    const app = buildApp()
    await postConfig(app, `http://127.0.0.1:${upstream.port}`)
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await waitReady(app, true)).ready).toBe(true)

    const d = await dashboard(app)
    const all = d.aggregate.overallAll
    const unc = d.aggregate.overallUncached

    // 分子分母同源：全量 6 条、非缓存 3 条、缓存 3 条
    expect(d.aggregate.totalCount).toBe(6)
    expect(all.count).toBe(6)
    expect(unc.count).toBe(3)
    expect(d.aggregate.totalCached).toBe(3)
    expect(d.aggregate.overallCacheRate).toBeCloseTo(0.5, 6)

    // 全量平均 310/6 ≈ 51.67，非缓存平均 310/3 ≈ 103.33
    expect(all.avg).toBeCloseTo(310 / 6, 6)
    expect(unc.avg).toBeCloseTo(310 / 3, 6)

    // 三项以上不同
    expect(all.avg).not.toBeCloseTo(unc.avg, 3)
    expect(all.p50).not.toBe(unc.p50)
    expect(all.p95).not.toBe(unc.p95)

    // 13 个字段全在，且全量分布的真值（sorted [0,0,0,10,100,200]）
    expect(Object.keys(all).sort()).toEqual(
      ['avg', 'count', 'max', 'min', 'p20', 'p50', 'p60', 'p70', 'p80', 'p95', 'p99', 'severeRate', 'slowRate'].sort(),
    )
    expect(all.count).toBe(6)
    expect(all.min).toBe(0)
    expect(all.max).toBe(200)
    for (const [key, expected] of Object.entries({
      avg: 310 / 6,
      p20: 0,
      p50: 5,
      p60: 10,
      p70: 55,
      p80: 100,
      p95: 175,
      p99: 195,
      slowRate: 0,
      severeRate: 0,
    })) {
      expect(all[key as keyof typeof all], `all.${key}`).toBeCloseTo(expected, 6)
    }

    // 非缓存分布（sorted [10,100,200]）
    expect(unc.count).toBe(3)
    expect(unc.min).toBe(10)
    expect(unc.max).toBe(200)
    for (const [key, expected] of Object.entries({
      avg: 310 / 3,
      p50: 100,
      p60: 120,
      p70: 140,
      p80: 160,
      p95: 190,
      p99: 198,
    })) {
      expect(unc[key as keyof typeof unc], `uncached.${key}`).toBeCloseTo(expected, 6)
    }

    await app.close()
    upstream.close()
  })

  it('R4 最小延时非 0 的数据集：min/p20/p99 都是真值（字段被写死成 0 时这条必挂）', async () => {
    const upstream = await startUpstream({
      entries: [
        querylogEntry('a.example.com', '2', false),
        querylogEntry('a.example.com', '20', false),
        querylogEntry('b.example.com', '5', false),
        querylogEntry('b.example.com', '8', true),
      ],
    })
    const app = buildApp()
    await postConfig(app, `http://127.0.0.1:${upstream.port}`)
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await waitReady(app, true)).ready).toBe(true)

    const d = await dashboard(app)
    const all = d.aggregate.overallAll

    // 全量 sorted [2,5,8,20]，一条 0ms 都没有：字段写死成 0 时下面的断言全部失败
    expect(all.count).toBe(4)
    expect(all.min).toBeGreaterThan(0)
    expect(all.p20).toBeGreaterThan(0)
    expect(all.p99).toBeGreaterThan(0)
    for (const [key, expected] of Object.entries({
      min: 2,
      max: 20,
      avg: 35 / 4,
      p20: 3.8,
      p50: 6.5,
      p60: 7.4,
      p70: 9.2,
      p80: 12.8,
      p95: 18.2,
      p99: 19.64,
    })) {
      expect(all[key as keyof typeof all], `all.${key}`).toBeCloseTo(expected, 6)
    }
    // 只有语义上确实为 0 的两个字段是 0
    expect(all.slowRate).toBe(0)
    expect(all.severeRate).toBe(0)

    await app.close()
    upstream.close()
  })
})

describe('C9 刷新途中改配置', () => {
  it('旧上游的结果被丢弃，缓存不被污染，后续刷新仍可用', async () => {
    const slow = await startUpstream({ entries: [querylogEntry('old.example.com', '50', false)], delayMs: 600 })
    const fast = await startUpstream({ entries: [querylogEntry('new.example.com', '5', false)] })
    const slowUrl = `http://127.0.0.1:${slow.port}`
    const fastUrl = `http://127.0.0.1:${fast.port}`
    const app = buildApp()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await postConfig(app, slowUrl)
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await postConfig(app, fastUrl)).statusCode).toBe(200)

    await sleep(1200) // 等旧上游那轮刷新落地
    expect(slow.requests.some(r => r.includes('/control/querylog'))).toBe(true)

    const s = await summary(app)
    expect(s.ready).toBe(false)
    expect(s.domainCount).toBe(0)
    expect(s.lastUpdated).toBeNull()
    expect(s.adguardUrl).toBe(fastUrl)

    // R1: 被丢弃的那一轮要给前端一条能直接显示的提示，且不含版本号等内部术语
    expect(s.lastError).toBeTruthy()
    expect(s.lastError).toMatch(/重新刷新/)
    expect(s.lastError).not.toMatch(/version|版本/i)

    const detail = await app.inject({ method: 'GET', url: '/api/analysis/domain-detail?domain=old.example.com' })
    expect(detail.statusCode).toBe(404)

    const d = await dashboard(app)
    expect(d.domains).toEqual([])
    expect(d.aggregate.totalCount).toBe(0)
    expect(d.lastError).toMatch(/重新刷新/)   // 前端轮询结束后的 dashboard 也带同一条提示

    expect(warn.mock.calls.some(args => String(args[0]).includes('Refresh discarded'))).toBe(true)
    warn.mockRestore()

    // 新配置下再刷一次应当正常落地
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await waitReady(app, true)).ready).toBe(true)
    const d2 = await dashboard(app)
    expect(d2.domains.map((x: any) => x.domain)).toEqual(['new.example.com'])
    expect(d2.adguardUrl).toBe(fastUrl)

    await app.close()
    slow.close()
    fast.close()
  })
})

describe('C10 缓存失效判据', () => {
  it('同配置重发（含 rejectUnauthorized 变化）不清缓存；改密码 / 改 timeRangeHours 清', async () => {
    const upstream = await startUpstream({ entries: [querylogEntry('a.example.com', '10', false)] })
    const url = `http://127.0.0.1:${upstream.port}`
    const app = buildApp()

    await postConfig(app, url)
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await waitReady(app, true)).domainCount).toBe(1)

    // 前端每次加载都会 POST 这份配置，rejectUnauthorized 从 true 变 false 不该清缓存
    await postConfig(app, url, { rejectUnauthorized: false })
    const afterSame = await summary(app)
    expect(afterSame.ready).toBe(true)
    expect(afterSame.domainCount).toBe(1)

    // 只改密码
    await postConfig(app, url, { password: 'p2' })
    const afterPass = await summary(app)
    expect(afterPass.ready).toBe(false)
    expect(afterPass.domainCount).toBe(0)

    // 恢复密码并刷新，再只改 timeRangeHours
    await postConfig(app, url)
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await waitReady(app, true)).domainCount).toBe(1)

    await postConfig(app, url, { timeRangeHours: 168 })
    const afterRange = await summary(app)
    expect(afterRange.ready).toBe(false)
    expect(afterRange.domainCount).toBe(0)

    await app.close()
    upstream.close()
  })

  it('R2 同一地址带不带尾斜杠算同一份配置，不清缓存且回显保持原始值', async () => {
    const upstream = await startUpstream({ entries: [querylogEntry('a.example.com', '10', false)] })
    const url = `http://127.0.0.1:${upstream.port}`
    const app = buildApp()

    await postConfig(app, url)
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect((await waitReady(app, true)).domainCount).toBe(1)

    await postConfig(app, url + '/')
    const s = await summary(app)
    expect(s.ready).toBe(true)
    expect(s.domainCount).toBe(1)
    // 存储与回显仍是原始值：尾斜杠只被签名内部忽略，没被改写
    expect(s.adguardUrl).toBe(url + '/')

    await app.close()
    upstream.close()
  })

  it('stats 缓存的 key 跟着配置签名，签名变了立刻回源', async () => {
    const upstream = await startUpstream({ entries: [querylogEntry('a.example.com', '10', false)] })
    const url = `http://127.0.0.1:${upstream.port}`
    const app = buildApp()

    await postConfig(app, url)
    const first = await app.inject({ method: 'GET', url: '/api/analysis/stats' })
    const second = await app.inject({ method: 'GET', url: '/api/analysis/stats' })
    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(upstream.requests.filter(r => r.includes('/control/stats'))).toHaveLength(1) // 30s TTL 内命中缓存

    await postConfig(app, url, { password: 'p2' })
    const third = await app.inject({ method: 'GET', url: '/api/analysis/stats' })
    expect(third.statusCode).toBe(200)
    expect(upstream.requests.filter(r => r.includes('/control/stats'))).toHaveLength(2) // 签名变了不等 TTL

    await app.close()
    upstream.close()
  })
})