import type { AdguardStats } from 'shared'
import type { AdguardConfig } from './client.js'
import { isDebugEnabled } from './client.js'
import { dispatcherFor, type FetchInit } from './dispatcher.js'

/** Raw response from AdGuardHome /control/stats */
export interface RawStats {
  top_queried_domains: Array<Record<string, number>>
  top_clients: Array<Record<string, number>>
  top_blocked_domains: Array<Record<string, number>>
  top_upstreams_responses: Array<Record<string, number>>
  top_upstreams_avg_time: Array<Record<string, number>>
  dns_queries: number[]
  blocked_filtering: number[]
  num_dns_queries: number
  num_blocked_filtering: number
  num_replaced_safebrowsing: number
  num_replaced_safesearch: number
  num_replaced_parental: number
  avg_processing_time: number
  time_units: string
}

export async function fetchStats(config: AdguardConfig): Promise<AdguardStats> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  const res = await fetch(`${baseUrl}/control/stats`, {
    headers: {
      authorization: `Basic ${auth}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
    dispatcher: dispatcherFor(config.rejectUnauthorized),
  } as FetchInit)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AdGuardHome stats API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const raw = (await res.json()) as RawStats

  // Build upstream avg-time lookup
  const upstreamAvgMap = new Map<string, number>()
  for (const item of raw.top_upstreams_avg_time) {
    const [[upstream, avg]] = Object.entries(item)
    upstreamAvgMap.set(upstream, avg)
  }

  // Fetch client names from recent query log
  const clientNameMap = await fetchClientNames(baseUrl, auth, config.rejectUnauthorized)

  return {
    avgProcessingTime: raw.avg_processing_time,
    totalQueries: raw.num_dns_queries,
    totalBlocked: raw.num_blocked_filtering,
    topQueriedDomains: raw.top_queried_domains.map(d => {
      const [[domain, count]] = Object.entries(d)
      return { domain, count }
    }),
    topClients: raw.top_clients.map(c => {
      const [[ip, count]] = Object.entries(c)
      return { ip, count, name: clientNameMap.get(ip) }
    }),
    topBlockedDomains: raw.top_blocked_domains.map(d => {
      const [[domain, count]] = Object.entries(d)
      return { domain, count }
    }),
    topUpstreams: raw.top_upstreams_responses.map(u => {
      const [[upstream, count]] = Object.entries(u)
      return {
        upstream,
        count,
        avgTime: upstreamAvgMap.get(upstream) ?? 0,
      }
    }),
    history: raw.dns_queries.map((queries, i) => ({
      queries,
      blocked: raw.blocked_filtering[i] ?? 0,
    })),
    timeSpan: {
      count: raw.dns_queries.length,
      unit: raw.time_units || 'days',
    },
  }
}

/** Fetch a recent query log page to resolve client IP → hostname mapping */
async function fetchClientNames(baseUrl: string, auth: string, rejectUnauthorized: boolean): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await fetch(`${baseUrl}/control/querylog?limit=100`, {
      headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      dispatcher: dispatcherFor(rejectUnauthorized),
    } as FetchInit)
    if (!res.ok) return map
    const json = await res.json() as { data: Array<{ client: string; client_info?: { name?: string } }> }
    for (const entry of json.data ?? []) {
      if (entry.client && entry.client_info?.name && !map.has(entry.client)) {
        map.set(entry.client, entry.client_info.name)
      }
    }
  } catch (err) {
    // N2: 不再静默吞错。这条只是附加信息（客户端名解析失败不影响主数据），
    // 所以按 ADGH_DEBUG 门控，未设时保持安静。
    if (isDebugEnabled()) {
      console.log('[DEBUG] client name lookup failed:', err instanceof Error ? err.message : String(err))
    }
  }
  return map
}
