/** AdGuardHome 查询日志原始记录 */
export interface QueryLogEntry {
  elapsedMs: number
  cached: boolean
  upstream: string
  status: string
  question: {
    name: string
    type: string // "A" | "AAAA" | "PTR" | "MX" | ...
  }
}

/** 延时百分位统计 */
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
  /** >500ms 占比 0~1 */
  slowRate: number
  /** >1s 占比 0~1 */
  severeRate: number
}

/** 按域名聚合后的统计结果 */
export interface DomainStats {
  domain: string
  totalCount: number
  cachedCount: number
  /** 0~1 */
  cacheHitRate: number
  /** 查询类型分布 e.g. { "A": 342, "AAAA": 85, "PTR": 12 } */
  queryTypes: Record<string, number>
  /** 仅 uncached 查询（上游真实性能） */
  uncached: LatencyStats
  /** 全部查询（用户实际体验） */
  all: LatencyStats
}

export type AnalysisResult = DomainStats[]
