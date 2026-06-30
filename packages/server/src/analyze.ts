import type { QueryLogEntry, AnalysisResult, DomainStats, LatencyStats } from 'shared'

/** 按域名聚合分析查询日志 */
export function analyze(entries: QueryLogEntry[]): AnalysisResult {
  const grouped = new Map<string, QueryLogEntry[]>()
  for (const entry of entries) {
    const list = grouped.get(entry.question.name)
    if (list) {
      list.push(entry)
    } else {
      grouped.set(entry.question.name, [entry])
    }
  }

  const result: AnalysisResult = []
  for (const [domain, domainEntries] of grouped) {
    const stats = computeDomainStats(domain, domainEntries)
    result.push(stats)
  }

  return result
}

function computeDomainStats(domain: string, entries: QueryLogEntry[]): DomainStats {
  const totalCount = entries.length
  const cachedEntries = entries.filter(e => e.cached)
  const cachedCount = cachedEntries.length
  const uncachedEntries = entries.filter(e => !e.cached)

  const uncachedLatencies = uncachedEntries.map(e => e.elapsedMs)
  const allLatencies = entries.map(e => e.elapsedMs)

  return {
    domain,
    totalCount,
    cachedCount,
    cacheHitRate: totalCount > 0 ? cachedCount / totalCount : 0,
    queryTypes: computeQueryTypes(entries),
    uncached: computeLatencyStats(uncachedLatencies),
    all: computeLatencyStats(allLatencies),
  }
}

function computeQueryTypes(entries: QueryLogEntry[]): Record<string, number> {
  const types: Record<string, number> = {}
  for (const e of entries) {
    const t = e.question.type
    types[t] = (types[t] ?? 0) + 1
  }
  return types
}

function computeLatencyStats(latencies: number[]): LatencyStats {
  const n = latencies.length
  if (n === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p20: 0, p50: 0, p80: 0, p95: 0, p99: 0, slowRate: 0, severeRate: 0 }
  }

  const sorted = [...latencies].sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const slowCount = sorted.filter(l => l > 500).length
  const severeCount = sorted.filter(l => l > 1000).length

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    avg: sum / n,
    p20: percentile(sorted, 20),
    p50: percentile(sorted, 50),
    p80: percentile(sorted, 80),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    slowRate: n > 0 ? slowCount / n : 0,
    severeRate: n > 0 ? severeCount / n : 0,
  }
}

/** 线性插值百分位计算 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]
  const k = (p / 100) * (sorted.length - 1)
  const floor = Math.floor(k)
  const ceil = Math.ceil(k)
  if (floor === ceil) return sorted[floor]
  const frac = k - floor
  return sorted[floor] * (1 - frac) + sorted[ceil] * frac
}
