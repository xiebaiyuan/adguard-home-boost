/** Mirror of server-side shared types for frontend consumption */

export interface LatencyStats {
  count: number
  min: number
  max: number
  avg: number
  p20: number
  p50: number
  p80: number
  p95: number
  p99: number
  slowRate: number
  severeRate: number
}

export interface DomainStats {
  domain: string
  totalCount: number
  cachedCount: number
  cacheHitRate: number
  queryTypes: Record<string, number>
  uncached: LatencyStats
  all: LatencyStats
}

export interface AnalysisSummary {
  ready: boolean
  timeRange: { start: string; end: string } | null
  lastUpdated: string | null
  lastError: string | null
  domainCount: number
  adguardUrl: string | null
}

export interface AdguardStats {
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
