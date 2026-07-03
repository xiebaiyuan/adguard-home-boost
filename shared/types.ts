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
  /** 发起查询的客户端 IP */
  client: string
  /** 客户端主机名（来自 AdGuardHome client_info） */
  clientName?: string
}

/** 延时百分位统计 */
export interface LatencyStats {
  count: number
  min: number
  max: number
  avg: number
  p20: number
  p50: number
  p60: number
  p70: number
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
  /** 查询此域名的客户端排行（按次数降序，最多 10 个） */
  topClients: Array<{
    ip: string
    /** 客户端主机名（来自 client_info.name） */
    name?: string
    count: number
  }>
}

export type AnalysisResult = DomainStats[]
