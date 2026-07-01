import type { AdguardConfig } from './client'

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

export interface StatsResult {
  avgProcessingTime: number
  totalQueries: number
  totalBlocked: number
  topQueriedDomains: Array<{ domain: string; count: number }>
  topClients: Array<{ ip: string; count: number; name?: string }>
  topBlockedDomains: Array<{ domain: string; count: number }>
  topUpstreams: Array<{ upstream: string; count: number; avgTime: number }>
  history: Array<{ queries: number; blocked: number }>
  timeSpan: { count: number; unit: string }
}

const PAGE_SIZE = 500
const MAX_ENTRIES = 100_000

export async function fetchStats(config: AdguardConfig): Promise<StatsResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  const res = await fetch(`${baseUrl}/control/stats`, {
    headers: {
      authorization: `Basic ${auth}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })

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
  const clientNameMap = await fetchClientNames(baseUrl, auth)

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
async function fetchClientNames(baseUrl: string, auth: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await fetch(`${baseUrl}/control/querylog?limit=100`, {
      headers: { authorization: `Basic ${auth}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return map
    const json = await res.json() as { data: Array<{ client: string; client_info?: { name?: string } }> }
    for (const entry of json.data ?? []) {
      if (entry.client && entry.client_info?.name && !map.has(entry.client)) {
        map.set(entry.client, entry.client_info.name)
      }
    }
  } catch {}
  return map
}
