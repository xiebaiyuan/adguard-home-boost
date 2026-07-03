import { describe, it, expect } from 'vitest'
import { fmtMs, fmtPct, fmtCount, fmtPreciseMs, TIME_OPTIONS, filterAndSortDomains } from './format'
import type { DomainStats } from './types'

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
    expect(TIME_OPTIONS[0]).toEqual({ label: '最近 24h', value: 24 })
    expect(TIME_OPTIONS[1]).toEqual({ label: '最近 7 天', value: 168 })
    expect(TIME_OPTIONS[2]).toEqual({ label: '最近 30 天', value: 720 })
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
    { domain: 'google.com', totalCount: 500, cachedCount: 450, cacheHitRate: 0.9, queryTypes: { A: 400, AAAA: 100 }, uncached: { p50: 15, p95: 120, slowRate: 0.02, count: 50, min: 5, max: 200, avg: 20, p20: 10, p60: 0, p70: 0, p80: 50, p99: 180, severeRate: 0 }, all: { count: 500, min: 3, max: 200, avg: 18, p20: 8, p60: 0, p70: 0, p50: 12, p80: 40, p95: 100, p99: 160, slowRate: 0.01, severeRate: 0 }, topClients: [], blockedCount: 0, blockedRate: 0, topBlockRules: [] },
    { domain: 'youtube.com', totalCount: 300, cachedCount: 180, cacheHitRate: 0.6, queryTypes: { A: 200, AAAA: 100 }, uncached: { p50: 30, p95: 400, slowRate: 0.15, count: 120, min: 10, max: 800, avg: 50, p20: 20, p60: 0, p70: 0, p80: 100, p99: 600, severeRate: 0.05 }, all: { count: 300, min: 8, max: 800, avg: 40, p20: 15, p60: 0, p70: 0, p50: 25, p80: 80, p95: 300, p99: 500, slowRate: 0.08, severeRate: 0.02 }, topClients: [], blockedCount: 0, blockedRate: 0, topBlockRules: [] },
    { domain: 'baidu.com', totalCount: 100, cachedCount: 20, cacheHitRate: 0.2, queryTypes: { A: 100 }, uncached: { p50: 200, p95: 1500, slowRate: 0.6, count: 80, min: 100, max: 3000, avg: 400, p20: 150, p60: 0, p70: 0, p80: 800, p99: 2500, severeRate: 0.3 }, all: { count: 100, min: 80, max: 3000, avg: 350, p20: 120, p60: 0, p70: 0, p50: 180, p80: 700, p95: 1200, p99: 2000, slowRate: 0.5, severeRate: 0.25 }, topClients: [], blockedCount: 0, blockedRate: 0, topBlockRules: [] },
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
})

