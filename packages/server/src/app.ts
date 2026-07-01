import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { resolve } from 'path'
import type { FastifyInstance } from 'fastify'
import type { AnalysisResult } from 'shared'
import type { AdguardConfig, RawFetchedEntry } from './adguard/client.js'
import { refreshFromAdguard } from './adguard/fetcher.js'
import { fetchStats } from './adguard/stats.js'
import { proxyAdguard } from './adguard/proxy.js'

interface CacheState {
  ready: boolean
  timeRange: { start: string; end: string } | null
  data: AnalysisResult | null
  lastUpdated: string | null
  lastError: string | null
  rawEntriesByDomain: Map<string, RawFetchedEntry[]>
}

export interface AppOptions {
  cacheSeed?: Map<string, RawFetchedEntry[]>
  adguardConfig?: AdguardConfig | null
}

export function buildApp(opts?: AppOptions): FastifyInstance {
  let adguardConfig = opts?.adguardConfig ?? null
  let refreshInProgress = false

  const cache: CacheState = {
    ready: false,
    timeRange: null,
    data: null,
    lastUpdated: null,
    lastError: null,
    rawEntriesByDomain: opts?.cacheSeed ?? new Map(),
  }

  // If cacheSeed is provided, treat as pre-loaded data
  if (opts?.cacheSeed && opts.cacheSeed.size > 0) {
    cache.ready = true
  }

  const app = Fastify({ logger: false })

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
      version: '0.1.0',
      adguardConfigured: adguardConfig !== null,
      adguardUrl: adguardConfig?.baseUrl ?? null,
    }
  })

  // Stats from AdGuardHome
  app.get('/api/analysis/stats', async (request, reply) => {
    if (!adguardConfig) {
      reply.status(400)
      return { error: 'AdGuardHome not configured' }
    }
    try {
      return await fetchStats(adguardConfig)
    } catch (err) {
      reply.status(502)
      return { error: err instanceof Error ? err.message : String(err) }
    }
  })

  // Summary
  app.get('/api/analysis/summary', async () => {
    return {
      ready: cache.ready,
      timeRange: cache.timeRange,
      lastUpdated: cache.lastUpdated,
      lastError: cache.lastError,
      domainCount: cache.data?.length ?? 0,
      adguardUrl: adguardConfig?.baseUrl ?? null,
    }
  })

  // Domain list
  app.get('/api/analysis/domains', async (request) => {
    const query = request.query as Record<string, string>
    let result = cache.data ?? []

    // Filter by query type
    if (query.type && query.type !== 'all') {
      result = result.filter(d => d.queryTypes[query.type] > 0)
    }

    // Search by domain
    if (query.search) {
      const search = query.search.toLowerCase()
      result = result.filter(d => d.domain.toLowerCase().includes(search))
    }

    // Sort
    const sortBy = query.sort ?? 'p95'
    const order = query.order ?? 'desc'
    const desc = order === 'desc'
    result = [...result].sort((a, b) => {
      let va: number, vb: number
      switch (sortBy) {
        case 'totalCount': va = a.totalCount; vb = b.totalCount; break
        case 'p50': va = a.uncached.p50; vb = b.uncached.p50; break
        case 'cacheHitRate': va = a.cacheHitRate; vb = b.cacheHitRate; break
        case 'slowRate': va = a.uncached.slowRate; vb = b.uncached.slowRate; break
        case 'p95':
        default: va = a.uncached.p95; vb = b.uncached.p95; break
      }
      return desc ? vb - va : va - vb
    })

    // Limit
    const limit = parseInt(query.limit ?? '50', 10)
    result = result.slice(0, Math.min(limit, 500))

    return result
  })

  // Domain detail
  app.get<{ Params: { domain: string } }>('/api/analysis/domains/:domain', async (request, reply) => {
    const domain = decodeURIComponent(request.params.domain)
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

  // Debug: check raw cached field in first few entries
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

  // Configure AdGuardHome connection
  app.post<{ Body: { adguardConfig: AdguardConfig } }>('/api/config', async (request, reply) => {
    const newConfig = request.body.adguardConfig

    // Normalize URL: add http:// if no protocol specified
    let url = newConfig.baseUrl
    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`
    }
    newConfig.baseUrl = url

    // 切换后端时清除旧缓存
    if (adguardConfig?.baseUrl !== newConfig.baseUrl) {
      cache.data = null
      cache.rawEntriesByDomain = new Map()
      cache.timeRange = null
      cache.lastUpdated = null
      cache.ready = false
    }

    adguardConfig = newConfig
    if (!adguardConfig.rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }
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

    refreshFromAdguard(adguardConfig)
      .then(result => {
        cache.data = result.domainStats
        cache.rawEntriesByDomain = result.rawEntriesByDomain
        cache.timeRange = result.timeRange.start ? result.timeRange : null
        cache.lastUpdated = new Date().toISOString()
        cache.ready = true
        refreshInProgress = false
      })
      .catch(err => {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Refresh failed:', msg)
        cache.lastError = msg
        cache.ready = false
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
    const result = await proxyAdguard(adguardConfig!, 'GET', targetPath)
    reply.status(result.status)
    return result.data
  })

  app.post('/api/adguard/*', async (request, reply) => {
    const blocked = adguardGuard(reply)
    if (blocked) return blocked
    const targetPath = '/' + (request.params as any)['*']
    const result = await proxyAdguard(adguardConfig!, 'POST', targetPath, request.body)
    reply.status(result.status)
    return result.data
  })

  return app
}
