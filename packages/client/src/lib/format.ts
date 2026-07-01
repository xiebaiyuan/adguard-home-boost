import type { DomainStats } from './types'

export function fmtMs(n: number): string {
  return `${Math.round(n)}ms`
}

/** For sub-ms precision: shows µs when <1ms, otherwise 1 decimal */
export function fmtPreciseMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  return `${ms.toFixed(1)}ms`
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function fmtCount(n: number): string {
  return n.toLocaleString()
}

export type SortKey = 'domain' | 'p95' | 'p50' | 'cacheHitRate' | 'slowRate' | 'totalCount'

export function filterAndSortDomains(
  domains: DomainStats[],
  search: string,
  typeFilter: string,
  sortKey: SortKey,
  sortDesc: boolean,
): DomainStats[] {
  let filtered = domains.filter(d => d.domain.toLowerCase().includes(search.toLowerCase()))
  if (typeFilter !== 'all') {
    filtered = filtered.filter(d => d.queryTypes[typeFilter] > 0)
  }
  return [...filtered].sort((a, b) => {
    let va: number | string, vb: number | string
    switch (sortKey) {
      case 'domain': va = a.domain; vb = b.domain; break
      case 'p95': va = a.uncached.p95; vb = b.uncached.p95; break
      case 'p50': va = a.uncached.p50; vb = b.uncached.p50; break
      case 'cacheHitRate': va = a.cacheHitRate; vb = b.cacheHitRate; break
      case 'slowRate': va = a.uncached.slowRate; vb = b.uncached.slowRate; break
      case 'totalCount': va = a.totalCount; vb = b.totalCount; break
    }
    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb)
    }
    const na = va as number, nb = vb as number
    return sortDesc ? nb - na : na - nb
  })
}
