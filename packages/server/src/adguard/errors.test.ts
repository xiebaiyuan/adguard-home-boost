import { createServer } from 'node:http'
import { beforeAll, describe, expect, it } from 'vitest'
import { describeFetchError } from './errors.js'
import { fetchStats } from './stats.js'
import { proxyAdguard } from './proxy.js'
import { buildApp } from '../app.js'
import type { AdguardConfig } from './client.js'

/** 占一个端口再立刻放掉，得到一个「没人听」的地址（真实码因平台而异，断言不写死码值） */
async function reserveDeadPort(): Promise<number> {
  const probe = createServer(() => {})
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', () => resolve()))
  const port = (probe.address() as any).port
  await new Promise<void>(resolve => probe.close(() => resolve()))
  return port
}

describe('D1 describeFetchError', () => {
  it('没有 cause 时原样返回 message，不凭空加括号', () => {
    expect(describeFetchError(new Error('boom'))).toBe('boom')
    expect(describeFetchError('plain string')).toBe('plain string')
  })

  it('一层 cause 的 code 拼进括号', () => {
    const err = new Error('fetch failed', {
      cause: Object.assign(new Error('mid'), { code: 'UND_ERR_SOCKET' }),
    })
    expect(describeFetchError(err)).toBe('fetch failed (UND_ERR_SOCKET)')
  })

  it('沿 cause 链最多两层：第二层能取到，第三层不再往下找', () => {
    const level2 = Object.assign(new Error('deep'), { code: 'EAI_AGAIN' })
    const two = new Error('fetch failed', { cause: new Error('mid', { cause: level2 }) })
    expect(describeFetchError(two)).toBe('fetch failed (EAI_AGAIN)')

    const level3 = Object.assign(new Error('deepest'), { code: 'TOO_DEEP' })
    const three = new Error('fetch failed', { cause: new Error('a', { cause: new Error('b', { cause: level3 }) }) })
    expect(describeFetchError(three)).toBe('fetch failed')
  })

  it('AggregateError 挑第一个带 code 的', () => {
    const agg = new Error('fetch failed', {
      cause: new AggregateError([new Error('x'), Object.assign(new Error('y'), { code: 'ECONNRESET' })], 'all failed'),
    })
    expect(describeFetchError(agg)).toBe('fetch failed (ECONNRESET)')
  })

  it('已经带 code 的消息再走一遍不变（幂等）', () => {
    expect(describeFetchError(new Error('fetch failed (ECONNREFUSED)'))).toBe('fetch failed (ECONNREFUSED)')
  })
})

describe('D1 死亡上游下的真实错误串', () => {
  // 只用于断言错误串里不夹凭据；值本身是测试夹具，不是真凭据
  const TEST_PASSWORD = 'fixture-pw-8f31c2'
  let config: AdguardConfig
  let deadUrl = ''

  beforeAll(async () => {
    const port = await reserveDeadPort()
    deadUrl = `http://127.0.0.1:${port}`
    config = { baseUrl: deadUrl, username: 'u', password: TEST_PASSWORD, rejectUnauthorized: true }
  })

  it('前提：连接失败时 message 只有 fetch failed，具体原因在 cause.code 上', async () => {
    let message = ''
    let code = ''
    try {
      await fetch(`${deadUrl}/x`)
    } catch (err: any) {
      message = err.message
      code = err.cause?.code ?? ''
    }
    expect(message).toBe('fetch failed')
    expect(code).not.toBe('')
  })

  it('fetchStats 保持原始错误对象：message 仍是 fetch failed、cause.code 还在', async () => {
    // D1 只在用户可见边界拼 code（路由 catch、proxy catch），不在这里改写错误对象，
    // 免得把 cause 链剥掉——调用方（含测试）还要靠它取 code。
    let message = ''
    let code = ''
    try {
      await fetchStats(config)
    } catch (err: any) {
      message = err.message
      code = err.cause?.code ?? ''
    }
    expect(message).toBe('fetch failed')
    expect(code).not.toBe('')
  })

  it('proxyAdguard 的 502 body 带非空 cause code', async () => {
    const proxied = await proxyAdguard(config, 'GET', '/status')
    expect(proxied.status).toBe(502)
    const error = (proxied.data as { error: string }).error
    expect(error).toContain('(')
    expect(error).toMatch(/\(\S+\)/)
    expect(error).not.toBe('fetch failed')
  })

  it('刷新路径：summary.lastError 带 code，且不含凭据与完整请求 URL', async () => {
    const app = buildApp()
    await app.inject({ method: 'POST', url: '/api/config', payload: { adguardConfig: config } })
    await app.inject({ method: 'POST', url: '/api/analysis/refresh' })

    let lastError: string | null = null
    for (let i = 0; i < 40 && !lastError; i++) {
      await new Promise(r => setTimeout(r, 50))
      const summary = JSON.parse((await app.inject({ method: 'GET', url: '/api/analysis/summary' })).body)
      lastError = summary.lastError
    }

    expect(lastError).toMatch(/\(\S+\)/)
    expect(lastError).not.toBe('fetch failed')
    expect(lastError).not.toContain(TEST_PASSWORD)
    expect(lastError).not.toContain('http://')
    await app.close()
  })

  it('/api/analysis/stats 的 502 body 也带 code', async () => {
    const app = buildApp({ adguardConfig: config })
    const res = await app.inject({ method: 'GET', url: '/api/analysis/stats' })
    expect(res.statusCode).toBe(502)
    const error = JSON.parse(res.body).error
    expect(error).toContain('(')
    expect(error).toMatch(/\(\S+\)/)
    expect(error).not.toBe('fetch failed')
    await app.close()
  })
})