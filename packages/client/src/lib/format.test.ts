import { describe, it, expect } from 'vitest'
import { fmtMs, fmtPct, fmtCount, fmtPreciseMs, TIME_OPTIONS, filterAndSortDomains } from './format'
import type { DomainStats } from 'shared'

describe('fmtMs', () => {
  it('should format milliseconds as integer with ms suffix', () => {
    expect(fmtMs(45)).toBe('45ms')
    expect(fmtMs(0)).toBe('0ms')
    expect(fmtMs(1234)).toBe('1234ms')
    expect(fmtMs(99.7)).toBe('100ms')
  })
})

describe('fmtPreciseMs', () => {
  it('should format sub-ms as µs', () => {
    expect(fmtPreciseMs(0.5)).toBe('500µs')
    expect(fmtPreciseMs(0.0066)).toBe('7µs')
    expect(fmtPreciseMs(0.999)).toBe('999µs')
  })

  it('should format 1ms+ with one decimal', () => {
    expect(fmtPreciseMs(1)).toBe('1.0ms')
    expect(fmtPreciseMs(6.598)).toBe('6.6ms')
    expect(fmtPreciseMs(123.45)).toBe('123.5ms')
    expect(fmtPreciseMs(0)).toBe('0µs')
  })
})

describe('TIME_OPTIONS', () => {
  it('should have correct time options', () => {
    expect(TIME_OPTIONS).toHaveLength(3)
    expect(TIME_OPTIONS[0]).toEqual({ label: '24h', value: 24 })
    expect(TIME_OPTIONS[1]).toEqual({ label: '7d', value: 168 })
    expect(TIME_OPTIONS[2]).toEqual({ label: '30d', value: 720 })
  })
})

describe('fmtPct', () => {
  it('should format 0-1 as percentage with one decimal', () => {
    expect(fmtPct(0.85)).toBe('85.0%')
    expect(fmtPct(0.33333)).toBe('33.3%')
    expect(fmtPct(1)).toBe('100.0%')
    expect(fmtPct(0)).toBe('0.0%')
  })
})

describe('fmtCount', () => {
  it('should format large numbers with locale separators', () => {
    expect(fmtCount(1000)).toBe('1,000')
    expect(fmtCount(42)).toBe('42')
    expect(fmtCount(9999999)).toBe('9,999,999')
  })
})

describe('filterAndSortDomains', () => {
  const domains: DomainStats[] = [
    { domain: 'google.com', totalCount: 500, cachedCount: 450, cacheHitRate: 0.9, queryTypes: { A: 400, AAAA: 100 }, uncached: { p50: 15, p95: 120, slowRate: 0.02, count: 50, min: 5, max: 200, avg: 20, p20: 10, p60: 0, p70: 0, p80: 50, p99: 180, severeRate: 0 }, topClients: [], blockedCount: 0, blockedRate: 0, topBlockRules: [] },
    { domain: 'youtube.com', totalCount: 300, cachedCount: 180, cacheHitRate: 0.6, queryTypes: { A: 200, AAAA: 100 }, uncached: { p50: 30, p95: 400, slowRate: 0.15, count: 120, min: 10, max: 800, avg: 50, p20: 20, p60: 0, p70: 0, p80: 100, p99: 600, severeRate: 0.05 }, topClients: [], blockedCount: 0, blockedRate: 0, topBlockRules: [] },
    { domain: 'baidu.com', totalCount: 100, cachedCount: 20, cacheHitRate: 0.2, queryTypes: { A: 100 }, uncached: { p50: 200, p95: 1500, slowRate: 0.6, count: 80, min: 100, max: 3000, avg: 400, p20: 150, p60: 0, p70: 0, p80: 800, p99: 2500, severeRate: 0.3 }, topClients: [], blockedCount: 0, blockedRate: 0, topBlockRules: [] },
  ]

  it('should sort by p95 descending by default', () => {
    const result = filterAndSortDomains(domains, '', 'all', 'p95', true)
    expect(result.map(d => d.domain)).toEqual(['baidu.com', 'youtube.com', 'google.com'])
  })

  it('should sort by p95 ascending', () => {
    const result = filterAndSortDomains(domains, '', 'all', 'p95', false)
    expect(result.map(d => d.domain)).toEqual(['google.com', 'youtube.com', 'baidu.com'])
  })

  it('should sort by cacheHitRate descending', () => {
    const result = filterAndSortDomains(domains, '', 'all', 'cacheHitRate', true)
    expect(result.map(d => d.domain)).toEqual(['google.com', 'youtube.com', 'baidu.com'])
  })

  it('should sort by totalCount descending', () => {
    const result = filterAndSortDomains(domains, '', 'all', 'totalCount', true)
    expect(result.map(d => d.domain)).toEqual(['google.com', 'youtube.com', 'baidu.com'])
  })

  it('should filter by search string', () => {
    const result = filterAndSortDomains(domains, 'google', 'all', 'p95', true)
    expect(result.map(d => d.domain)).toEqual(['google.com'])
  })

  it('should filter by query type', () => {
    const result = filterAndSortDomains(domains, '', 'AAAA', 'p95', true)
    // baidu.com has no AAAA queries
    expect(result.map(d => d.domain)).toEqual(['youtube.com', 'google.com'])
  })

  it('should return empty array for no match', () => {
    const result = filterAndSortDomains(domains, 'nonexistent', 'all', 'p95', true)
    expect(result).toEqual([])
  })

  it('should sort by domain alphabetically ascending', () => {
    const result = filterAndSortDomains(domains, '', 'all', 'domain', false)
    expect(result.map(d => d.domain)).toEqual(['baidu.com', 'google.com', 'youtube.com'])
  })

  it('should sort by blockedCount descending', () => {
    const customDomains = [
      { ...domains[0], domain: 'a.com', blockedCount: 5, blockedRate: 0.5, topBlockRules: [] },
      { ...domains[0], domain: 'b.com', blockedCount: 20, blockedRate: 0.8, topBlockRules: [] },
      { ...domains[0], domain: 'c.com', blockedCount: 0, blockedRate: 0, topBlockRules: [] },
    ]
    const result = filterAndSortDomains(customDomains, '', 'all', 'blockedCount', true)
    expect(result.map(d => d.domain)).toEqual(['b.com', 'a.com', 'c.com'])
  })

  it('should sort by blockedCount ascending', () => {
    const customDomains = [
      { ...domains[0], domain: 'a.com', blockedCount: 5, blockedRate: 0.5, topBlockRules: [] },
      { ...domains[0], domain: 'b.com', blockedCount: 20, blockedRate: 0.8, topBlockRules: [] },
      { ...domains[0], domain: 'c.com', blockedCount: 0, blockedRate: 0, topBlockRules: [] },
    ]
    const result = filterAndSortDomains(customDomains, '', 'all', 'blockedCount', false)
    expect(result.map(d => d.domain)).toEqual(['c.com', 'a.com', 'b.com'])
  })
})

