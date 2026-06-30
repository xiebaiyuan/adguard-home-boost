import type { AnalysisResult, QueryLogEntry } from 'shared'
import type { AdguardConfig, RawFetchedEntry } from './client'
import { fetchQueryLog } from './client'
import { analyze } from '../analyze'

export interface RefreshResult {
  domainStats: AnalysisResult
  rawEntriesByDomain: Map<string, RawFetchedEntry[]>
  timeRange: { start: string; end: string }
}

export async function refreshFromAdguard(config: AdguardConfig): Promise<RefreshResult> {
  const rawEntries = await fetchQueryLog(config)

  if (rawEntries.length === 0) {
    return {
      domainStats: [],
      rawEntriesByDomain: new Map(),
      timeRange: { start: '', end: '' },
    }
  }

  // Convert to QueryLogEntry for the analyze engine
  const analyzeEntries: QueryLogEntry[] = rawEntries.map(e => ({
    elapsedMs: e.elapsedMs,
    cached: e.cached,
    upstream: e.upstream,
    status: e.status,
    question: { name: e.question.name, type: e.question.type },
  }))

  const domainStats = analyze(analyzeEntries)

  // Group raw entries by domain for deep-dive lookups
  const rawEntriesByDomain = new Map<string, RawFetchedEntry[]>()
  for (const entry of rawEntries) {
    const domain = entry.question.name
    const list = rawEntriesByDomain.get(domain)
    if (list) {
      list.push(entry)
    } else {
      rawEntriesByDomain.set(domain, [entry])
    }
  }

  // Determine actual time range from the data
  const times = rawEntries.map(e => e.time).filter(Boolean).sort()
  const start = times[0] ?? ''
  const end = times[times.length - 1] ?? ''

  return { domainStats, rawEntriesByDomain, timeRange: { start, end } }
}
