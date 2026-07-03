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
  const uncachedLatencies: number[] = []
  const allLatencies: number[] = []
  const queryTypes: Record<string, number> = {}
  let cachedCount = 0
  const clientCounts = new Map<string, { ip: string; name?: string; count: number }>()
  let blockedCount = 0
  const blockRuleCounts = new Map<string, number>()

  // 单次遍历：同时收集缓存统计、延时列表、查询类型分布、客户端排行、拦截统计
  for (const e of entries) {
    allLatencies.push(e.elapsedMs)
    if (e.cached) {
      cachedCount++
    } else {
      uncachedLatencies.push(e.elapsedMs)
    }
    const t = e.question.type
    queryTypes[t] = (queryTypes[t] ?? 0) + 1

    // 客户端排行
    if (e.client) {
      const existing = clientCounts.get(e.client)
      if (existing) {
        existing.count++
      } else {
        clientCounts.set(e.client, {
          ip: e.client,
          name: e.clientName || undefined,
          count: 1,
        })
      }
    }

    // 拦截统计：reason 以 NotFiltered 开头视为放行，其他（Filtered*、BlockedByRule 等）视为拦截
    if (e.blockReason && !e.blockReason.startsWith('NotFiltered')) {
      blockedCount++
      if (e.blockRule) {
        blockRuleCounts.set(e.blockRule, (blockRuleCounts.get(e.blockRule) ?? 0) + 1)
      }
    }
  }

  // 按次数降序取前 10
  const topClients = Array.from(clientCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topBlockRules = Array.from(blockRuleCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }))

  return {
    domain,
    totalCount,
    cachedCount,
    cacheHitRate: totalCount > 0 ? cachedCount / totalCount : 0,
    queryTypes,
    uncached: computeLatencyStats(uncachedLatencies),
    all: computeLatencyStats(allLatencies),
    topClients,
    blockedCount,
    blockedRate: totalCount > 0 ? blockedCount / totalCount : 0,
    topBlockRules,
  }
}

function computeLatencyStats(latencies: number[]): LatencyStats {
  const n = latencies.length
  if (n === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p20: 0, p50: 0, p60: 0, p70: 0, p80: 0, p95: 0, p99: 0, slowRate: 0, severeRate: 0 }
  }

  const sorted = [...latencies].sort((a, b) => a - b)

  // 单次遍历：同时计算 sum、slowCount、severeCount
  let sum = 0
  let slowCount = 0
  let severeCount = 0
  for (const v of sorted) {
    sum += v
    if (v > 1000) {
      severeCount++
      slowCount++
    } else if (v > 500) {
      slowCount++
    }
  }

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    avg: sum / n,
    p20: percentile(sorted, 20),
    p50: percentile(sorted, 50),
    p60: percentile(sorted, 60),
    p70: percentile(sorted, 70),
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
