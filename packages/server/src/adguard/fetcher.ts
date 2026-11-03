import type { AnalysisResult, QueryLogEntry } from 'shared'
import type { AdguardConfig, RawFetchedEntry } from './client.js'
import { fetchQueryLog } from './client.js'
import { analyze } from '../analyze.js'

/**
 * C7: 全局聚合要的是全量延时分布，不是各域名百分位的拼装。
 * 内存代价：10 万条量级下两个 number 数组约 1.6MB（V8 打包 double 数组 8 字节/元素，
 * all 100k ≈ 800KB，uncached 是它的子集），相对 10 万条 RawFetchedEntry 本身（含 answer
 * 数组）可以忽略，且只在进程内存里、随下次刷新替换。
 */
export interface LatencyDistribution {
  all: number[]
  uncached: number[]
}

export interface RefreshResult {
  domainStats: AnalysisResult
  rawEntriesByDomain: Map<string, RawFetchedEntry[]>
  timeRange: { start: string; end: string }
  latencies: LatencyDistribution
}

export async function refreshFromAdguard(config: AdguardConfig): Promise<RefreshResult> {
  const rawEntries = await fetchQueryLog(config)

  if (rawEntries.length === 0) {
    return {
      domainStats: [],
      rawEntriesByDomain: new Map(),
      timeRange: { start: '', end: '' },
      latencies: { all: [], uncached: [] },
    }
  }

  // Convert to QueryLogEntry for the analyze engine
  const analyzeEntries: QueryLogEntry[] = rawEntries.map(e => ({
    elapsedMs: e.elapsedMs,
    cached: e.cached,
    upstream: e.upstream,
    status: e.status,
    question: { name: e.question.name, type: e.question.type },
    client: e.client,
    clientName: e.clientName,
    blockReason: e.blockReason,
    blockRule: e.blockRule,
  }))

  const domainStats = analyze(analyzeEntries)

  // Group raw entries by domain for deep-dive lookups, 顺手收集全量延时分布
  const rawEntriesByDomain = new Map<string, RawFetchedEntry[]>()
  const latencies: LatencyDistribution = { all: [], uncached: [] }
  for (const entry of rawEntries) {
    const domain = entry.question.name
    const list = rawEntriesByDomain.get(domain)
    if (list) {
      list.push(entry)
    } else {
      rawEntriesByDomain.set(domain, [entry])
    }
    latencies.all.push(entry.elapsedMs)
    if (!entry.cached) latencies.uncached.push(entry.elapsedMs)
  }

  // Determine actual time range from the data
  const times = rawEntries.map(e => e.time).filter(Boolean).sort()
  const start = times[0] ?? ''
  const end = times[times.length - 1] ?? ''

  return { domainStats, rawEntriesByDomain, timeRange: { start, end }, latencies }
}
