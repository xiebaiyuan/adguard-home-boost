import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { resolve } from 'path'
import { readFileSync } from 'node:fs'
import { timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { AdguardStats, AnalysisResult, AnalysisSummary, DashboardPayload } from 'shared'
import type { AdguardConfig, RawFetchedEntry } from './adguard/client.js'
import type { LatencyDistribution } from './adguard/fetcher.js'
import { refreshFromAdguard } from './adguard/fetcher.js'
import { fetchStats } from './adguard/stats.js'
import { proxyAdguard } from './adguard/proxy.js'
import { describeFetchError } from './adguard/errors.js'
import { DEFAULT_ALLOWED_HOSTS, buildHostAllowlist } from './adguard/host-allowlist.js'
import { computeLatencyStats } from './analyze.js'

interface CacheState {
  ready: boolean
  timeRange: { start: string; end: string } | null
  data: AnalysisResult | null
  lastUpdated: string | null
  lastError: string | null
  rawEntriesByDomain: Map<string, RawFetchedEntry[]>
  /** C7: 全量延时分布，dashboard 的全局百分位从它算 */
  latencies: LatencyDistribution | null
}

/**
 * C10: 配置签名，只收影响数据内容的字段。
 * rejectUnauthorized 故意排除：它只决定 TLS 证书校不校，不影响抓回来的数据；
 * 而前端每次加载都会 POST 一次 rejectUnauthorized: false，算进签名会让每次刷页面都清缓存。
 * R2: baseUrl 在签名内部去掉尾斜杠——client.ts 取数据时也会 strip，两种写法语义相同，
 *     不清这一步会让 `http://h:p/` 与 `http://h:p` 误判成两份配置而清缓存。
 *     存储与回显用的仍是原始值，adguardUrl 的展示不变。
 */
function configKey(c: AdguardConfig | null): string {
  if (!c) return ''
  const baseUrl = c.baseUrl.replace(/\/$/, '')
  return JSON.stringify([baseUrl, c.username, c.password, c.timeRangeHours ?? 24])
}

export interface AppOptions {
  cacheSeed?: Map<string, RawFetchedEntry[]>
  adguardConfig?: AdguardConfig | null
}

/**
 * #24: 版本号唯一来源是 packages/client/package.json（CLAUDE.md 的 Version Constraint）。
 * app.ts 编译到 packages/server/{src,dist}，两种位置下 `../../client/package.json` 都指向同一文件。
 * 运行镜像里这个文件可能还没带上（task-17 的 #12 才补），读不到就回落到
 * `process.env.APP_VERSION ?? 'unknown'`，不抛异常、不影响启动。
 */
export function resolveAppVersion(baseDir: string = import.meta.dirname): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(baseDir, '../../client/package.json'), 'utf8')) as { version?: unknown }
    if (typeof pkg.version === 'string' && pkg.version.trim() !== '') return pkg.version.trim()
  } catch {
    // 文件不存在 / 内容坏了都走回落
  }
  return process.env.APP_VERSION ?? 'unknown'
}

/** C1: 恒定时间字符串比较。先补齐到同长度再比，长度不等直接判否 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  const len = Math.max(bufA.length, bufB.length, 1)
  const paddedA = Buffer.alloc(len)
  const paddedB = Buffer.alloc(len)
  bufA.copy(paddedA)
  bufB.copy(paddedB)
  return timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length
}

/** C1: 解析 Authorization: Basic，失败返回 null */
function parseBasicAuth(header: string | undefined): { user: string; pass: string } | null {
  if (!header) return null
  const match = /^Basic\s+(\S+)$/i.exec(header.trim())
  if (!match) return null
  const decoded = Buffer.from(match[1], 'base64').toString('utf8')
  const sep = decoded.indexOf(':')
  if (sep < 0) return null
  return { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) }
}

/** C3: 取原请求的原始 query 串，转发给 AdGuardHome 时带上 */
function requestQuery(request: { url: string }): string {
  const idx = request.url.indexOf('?')
  return idx < 0 ? '' : request.url.slice(idx + 1)
}

export function buildApp(opts?: AppOptions): FastifyInstance {
  let adguardConfig = opts?.adguardConfig ?? null
  let refreshInProgress = false
  // C9: 配置版本号，配置真的变了才递增；刷新落地前比对自己捕获的那份
  let configVersion = 0

  const cache: CacheState = {
    ready: false,
    timeRange: null,
    data: null,
    lastUpdated: null,
    lastError: null,
    rawEntriesByDomain: opts?.cacheSeed ?? new Map(),
    latencies: null,
  }

  // Stats cache (实时统计) — 30s TTL，带配置签名，配置变了立刻失效
  let statsCache: { data: AdguardStats; expiresAt: number; key: string } | null = null
  const STATS_TTL = 30_000

  // #24: 版本在启动时读一次（文件变了也不会在运行中漂）
  const appVersion = resolveAppVersion()

  // #2: baseUrl 主机白名单。未设置 ADGH_ALLOWED_HOSTS 时用默认策略（回环 + RFC1918，拒公网），
  // 见 adguard/host-allowlist.ts 的注释。改这个 env 需要重启进程。
  const hostAllowlist = buildHostAllowlist(process.env.ADGH_ALLOWED_HOSTS ?? DEFAULT_ALLOWED_HOSTS)

  // If cacheSeed is provided, treat as pre-loaded data
  if (opts?.cacheSeed && opts.cacheSeed.size > 0) {
    cache.ready = true
  }

  const app = Fastify({ logger: false })

  // C1: HTTP Basic 准入鉴权。两个 env 都非空才启用；在此之前注册，覆盖其后所有路由（含静态资源）
  const authUser = process.env.ADGH_AUTH_USER
  const authPass = process.env.ADGH_AUTH_PASSWD

  if (authUser && authPass) {
    app.addHook('onRequest', async (request, reply) => {
      const supplied = parseBasicAuth(request.headers.authorization)
      const userOk = safeEqual(supplied?.user ?? '', authUser)
      const passOk = safeEqual(supplied?.pass ?? '', authPass)
      if (!(userOk && passOk)) {
        reply.header('WWW-Authenticate', 'Basic realm="adguard-home-boost"')
        reply.status(401)
        return reply.send({ error: 'unauthorized' })
      }
    })
  }

  app.register(cors, {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  })

  // Serve built client static files in production
  if (process.env.NODE_ENV === 'production') {
    const clientDist = resolve(import.meta.dirname, '../../client/dist')
    app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    })
  }

  // Health check
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      version: appVersion,
      adguardConfigured: adguardConfig !== null,
      adguardUrl: adguardConfig?.baseUrl ?? null,
    }
  })

  // Stats from AdGuardHome (cached, 30s TTL)
  app.get('/api/analysis/stats', async (request, reply): Promise<AdguardStats | { error: string }> => {
    if (!adguardConfig) {
      reply.status(400)
      return { error: 'AdGuardHome not configured' }
    }
    if (statsCache && statsCache.key === configKey(adguardConfig) && Date.now() < statsCache.expiresAt) {
      return statsCache.data
    }
    try {
      const data = await fetchStats(adguardConfig)
      statsCache = { data, expiresAt: Date.now() + STATS_TTL, key: configKey(adguardConfig) }
      return data
    } catch (err) {
      reply.status(502)
      // D1: 在用户可见的边界补上 fetch 失败的 cause code（stats 内部的错误对象保持原样，cause 不被剥掉）
      return { error: describeFetchError(err) }
    }
  })

  // Summary
  app.get('/api/analysis/summary', async (): Promise<AnalysisSummary> => {
    return {
      ready: cache.ready,
      timeRange: cache.timeRange,
      lastUpdated: cache.lastUpdated,
      lastError: cache.lastError,
      domainCount: cache.data?.length ?? 0,
      adguardUrl: adguardConfig?.baseUrl ?? null,
    }
  })

  // Dashboard payload — 后端预聚合，前端一条请求拿到全部数据直接渲染
  app.get('/api/analysis/dashboard', async (): Promise<DashboardPayload> => {
    const domains = cache.data ?? []
    const ready = cache.ready
    const latencies = cache.latencies

    // C7: 全局百分位基于全量延时数组，和 per-domain 统计共用 computeLatencyStats。
    // 分子分母同源：all 系列只用 latencies.all，uncached 系列只用 latencies.uncached。
    const totalCount = latencies?.all.length ?? 0
    const uncachedCount = latencies?.uncached.length ?? 0
    const totalCached = totalCount - uncachedCount
    const overallCacheRate = totalCount > 0 ? totalCached / totalCount : 0

    const allLatency = totalCount > 0 ? computeLatencyStats(latencies!.all) : null
    const uncachedLatency = uncachedCount > 0 ? computeLatencyStats(latencies!.uncached) : null

    // queryTypes 仍按域名汇总（它本身就是分域统计）
    const queryTypeAcc: Record<string, number> = {}
    for (const d of domains) {
      for (const [t, c] of Object.entries(d.queryTypes)) {
        queryTypeAcc[t] = (queryTypeAcc[t] ?? 0) + c
      }
    }
    const queryTypeDistribution = Object.entries(queryTypeAcc)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }))

    return {
      ready,
      timeRange: cache.timeRange,
      lastUpdated: cache.lastUpdated,
      lastError: cache.lastError,
      adguardUrl: adguardConfig?.baseUrl ?? null,
      domainCount: domains.length,
      aggregate: {
        totalCount,
        totalCached,
        overallCacheRate,
        overallUncached: uncachedLatency,
        overallAll: allLatency,
      },
      queryTypeDistribution,
      domains: domains.slice(0, 500),
    }
  })

  // Domain detail — 使用查询参数避免 '.' 等特殊域名的路径标准化问题
  app.get('/api/analysis/domain-detail', async (request, reply) => {
    const query = request.query as Record<string, string>
    const domain = query.domain ?? ''
    if (!domain) {
      reply.status(400)
      return { error: 'domain query parameter is required' }
    }
    const entries = cache.rawEntriesByDomain.get(domain)

    if (!entries) {
      reply.status(404)
      return { error: 'domain not found', domain }
    }

    const byUpstream = new Map<string, RawFetchedEntry[]>()
    for (const entry of entries) {
      const list = byUpstream.get(entry.upstream)
      if (list) list.push(entry)
      else byUpstream.set(entry.upstream, [entry])
    }

    const upstreams = Array.from(byUpstream.entries()).map(([upstream, upsEntries]) => {
      const latencies = upsEntries.map(e => e.elapsedMs).sort((a, b) => a - b)
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      return {
        upstream,
        count: upsEntries.length,
        avg: Math.round(avg * 10) / 10,
        min: latencies[0],
        max: latencies[latencies.length - 1],
      }
    })

    return {
      domain,
      totalCount: entries.length,
      entries: entries.slice(0, 100).map(e => ({
        time: e.time,
        elapsedMs: e.elapsedMs,
        cached: e.cached,
        upstream: e.upstream,
        status: e.status,
        type: e.question.type,
        answer: e.answer?.slice(0, 3) ?? [],
      })),
      upstreams,
    }
  })

  // Debug: check raw cached field in first few entries（C5: 仅非生产环境注册）
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/cache-check', async () => {
      const samples: Array<{ domain: string; cached: boolean; cachedType: string; elapsedMs: number }> = []
      for (const [domain, entries] of cache.rawEntriesByDomain) {
        for (let i = 0; i < Math.min(3, entries.length); i++) {
          samples.push({
            domain,
            cached: entries[i].cached,
            cachedType: typeof entries[i].cached,
            elapsedMs: entries[i].elapsedMs,
          })
        }
        if (samples.length >= 20) break
      }
      return {
        totalDomains: cache.rawEntriesByDomain.size,
        totalEntries: Array.from(cache.rawEntriesByDomain.values()).reduce((s, e) => s + e.length, 0),
        sampleCount: samples.length,
        samples,
      }
    })
  }

  // Configure AdGuardHome connection
  app.post<{ Body: { adguardConfig?: Record<string, unknown> } }>('/api/config', async (request, reply) => {
    const raw = request.body?.adguardConfig

    // C4: 最小 body 校验，缺字段或类型不对返回 400
    if (!raw || typeof raw !== 'object') {
      reply.status(400)
      return { error: 'adguardConfig is required' }
    }
    const baseUrlRaw = raw.baseUrl
    if (typeof baseUrlRaw !== 'string' || baseUrlRaw.trim() === '') {
      reply.status(400)
      return { error: 'baseUrl must be a non-empty string' }
    }
    if (typeof raw.username !== 'string') {
      reply.status(400)
      return { error: 'username must be a string' }
    }
    if (typeof raw.password !== 'string') {
      reply.status(400)
      return { error: 'password must be a string' }
    }
    if (raw.rejectUnauthorized !== undefined && typeof raw.rejectUnauthorized !== 'boolean') {
      reply.status(400)
      return { error: 'rejectUnauthorized must be a boolean' }
    }
    if (raw.timeRangeHours !== undefined && (typeof raw.timeRangeHours !== 'number' || !Number.isFinite(raw.timeRangeHours))) {
      reply.status(400)
      return { error: 'timeRangeHours must be a number' }
    }

    // Normalize URL: add http:// if no protocol specified（显式 scheme 一律保留，交给下面的协议白名单判）
    let url = baseUrlRaw
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      url = `http://${url}`
    }

    // C4: new URL 解析 + 协议白名单 + 禁 userinfo
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      reply.status(400)
      // N1: 不回显原始输入（畸形串里可能夹 userinfo），只给原因
      return { error: 'baseUrl is not a valid URL' }
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reply.status(400)
      return { error: `baseUrl only supports http/https: ${parsed.protocol}` }
    }
    if (parsed.username || parsed.password) {
      reply.status(400)
      return { error: 'baseUrl must not contain userinfo; use username/password fields' }
    }
    // #2: 主机白名单。parsed.hostname 不含 userinfo，回显它是安全的（也便于排查）
    if (!hostAllowlist.allows(parsed.hostname)) {
      reply.status(400)
      return { error: `baseUrl host is not allowed: ${parsed.hostname}` }
    }

    const newConfig: AdguardConfig = {
      baseUrl: url,
      username: raw.username,
      password: raw.password,
      rejectUnauthorized: raw.rejectUnauthorized === true,
      timeRangeHours: raw.timeRangeHours as number | undefined,
    }

    // C10: 配置签名变了才清缓存 / 失效 stats 缓存；C9: 同时递增配置版本号
    if (configKey(adguardConfig) !== configKey(newConfig)) {
      cache.data = null
      cache.rawEntriesByDomain = new Map()
      cache.timeRange = null
      cache.lastUpdated = null
      cache.ready = false
      cache.latencies = null
      statsCache = null
      configVersion++
    }

    adguardConfig = newConfig
    cache.lastError = null
    reply.status(200)
    return { message: 'configuration updated', adguardUrl: adguardConfig.baseUrl }
  })

  // Refresh
  app.post('/api/analysis/refresh', async (_request, reply) => {
    if (!adguardConfig) {
      reply.status(400)
      return { error: 'AdGuardHome not configured', message: '请先配置环境变量 ADGH_URL / ADGH_USER / ADGH_PASSWD' }
    }

    if (refreshInProgress) {
      reply.status(409)
      return { error: 'refresh already in progress' }
    }

    refreshInProgress = true
    cache.lastError = null

    // C9: 捕获发起时的配置版本，落地前比对；不一致说明这轮结果属于旧配置，丢掉
    const startedAtVersion = configVersion
    // R1: 丢弃时前端既等不到 ready 也拿不到 lastError，会停在空面板上。
    //     这里写一条用户能直接读的消息（不带版本号等内部术语），轮询据此结束并提示。
    const DISCARDED_MESSAGE = '刷新期间配置被改了，这一轮结果已丢弃，请重新刷新'

    refreshFromAdguard(adguardConfig)
      .then(result => {
        if (startedAtVersion !== configVersion) {
          console.warn(`Refresh discarded: config changed during refresh (version ${startedAtVersion} -> ${configVersion})`)
          cache.lastError = DISCARDED_MESSAGE
          refreshInProgress = false
          return
        }
        cache.data = result.domainStats
        cache.rawEntriesByDomain = result.rawEntriesByDomain
        cache.timeRange = result.timeRange.start ? result.timeRange : null
        cache.lastUpdated = new Date().toISOString()
        cache.latencies = result.latencies
        cache.ready = true
        refreshInProgress = false
      })
      .catch(err => {
        const msg = describeFetchError(err)
        console.error('Refresh failed:', msg)
        if (startedAtVersion === configVersion) {
          cache.lastError = msg
          cache.ready = false
        } else {
          console.warn(`Refresh error discarded: config changed during refresh (version ${startedAtVersion} -> ${configVersion})`)
          cache.lastError = DISCARDED_MESSAGE
        }
        refreshInProgress = false
      })

    reply.status(202)
    return { message: 'refresh started' }
  })

  // Generic AdGuardHome management API proxy
  const adguardGuard = (reply: any) => {
    if (!adguardConfig) {
      reply.status(400)
      return { error: 'AdGuardHome not configured' }
    }
    return null
  }

  app.get('/api/adguard/*', async (request, reply) => {
    const blocked = adguardGuard(reply)
    if (blocked) return blocked
    const targetPath = '/' + (request.params as any)['*']
    const result = await proxyAdguard(adguardConfig!, 'GET', targetPath, undefined, requestQuery(request))
    reply.status(result.status)
    return result.data
  })

  app.post('/api/adguard/*', async (request, reply) => {
    const blocked = adguardGuard(reply)
    if (blocked) return blocked
    const targetPath = '/' + (request.params as any)['*']
    const result = await proxyAdguard(adguardConfig!, 'POST', targetPath, request.body, requestQuery(request))
    reply.status(result.status)
    return result.data
  })

  return app
}
