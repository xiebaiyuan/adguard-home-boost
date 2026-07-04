import type { DomainStats } from './types'

export interface RawEntry {
  time: string
  elapsedMs: number
  cached: boolean
  upstream: string
  status: string
  type: string
  answer: Array<{ type: string; value: string }>
}

export function exportCsv(domains: DomainStats[]) {
  const header = [
    'domain',
    'totalCount', 'cachedCount', 'cacheHitRate',
    'uncached_count', 'uncached_min', 'uncached_max', 'uncached_avg',
    'uncached_p20', 'uncached_p50', 'uncached_p80', 'uncached_p95', 'uncached_p99',
    'uncached_slowRate', 'uncached_severeRate',
    'queryTypes',
  ]

  const rows = domains.map(d => [
    d.domain,
    d.totalCount,
    d.cachedCount,
    (d.cacheHitRate * 100).toFixed(1) + '%',
    d.uncached.count,
    d.uncached.min,
    d.uncached.max,
    d.uncached.avg.toFixed(1),
    d.uncached.p20.toFixed(0),
    d.uncached.p50.toFixed(0),
    d.uncached.p80.toFixed(0),
    d.uncached.p95.toFixed(0),
    d.uncached.p99.toFixed(0),
    (d.uncached.slowRate * 100).toFixed(1) + '%',
    (d.uncached.severeRate * 100).toFixed(1) + '%',
    Object.entries(d.queryTypes).map(([t, c]) => `${t}:${c}`).join('; '),
  ])

  const csv = [
    header.join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `adguard-home-boost-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportDomainCsv(entries: RawEntry[]): string {
  const header = ['time', 'elapsedMs', 'cached', 'upstream', 'status', 'type', 'answer']

  const escapeCell = (v: string): string => {
    if (/^[=+\-@]/.test(v)) v = `'${v}` // prevent CSV injection
    if (/[,"\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`
    return v
  }

  const rows = entries.map(e => [
    e.time,
    String(e.elapsedMs),
    String(e.cached),
    e.upstream,
    e.status,
    e.type,
    e.answer.map(a => a.value).join('; '),
  ].map(escapeCell))

  return [header.join(','), ...rows.map(r => r.join(','))].join('\n')
}
