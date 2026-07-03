import { describe, it, expect } from 'vitest'
import { analyze } from './analyze.js'
import type { QueryLogEntry } from 'shared'

function q(name: string, elapsedMs: number, cached = false, type = 'A'): QueryLogEntry {
  return {
    elapsedMs,
    cached,
    upstream: 'tls://dns.quad9.net',
    status: 'NOERROR',
    question: { name, type },
    client: '192.168.1.100',
    clientName: 'test-device',
    blockReason: '',
    blockRule: '',
  }
}

/** 辅助函数：创建被拦截的查询条目 */
function blockedQ(name: string, rule: string, elapsedMs = 10): QueryLogEntry {
  return {
    elapsedMs,
    cached: false,
    upstream: '',
    status: 'NOERROR',
    question: { name, type: 'A' },
    client: '192.168.1.100',
    clientName: 'test-device',
    blockReason: 'FilteredBlackList',
    blockRule: rule,
  }
}

/** 辅助函数：创建含 NotFiltered 前缀的放行条目（模拟真实 API） */
function notFilteredQ(name: string, reason: string): QueryLogEntry {
  return {
    elapsedMs: 10,
    cached: false,
    upstream: 'tls://dns.quad9.net',
    status: 'NOERROR',
    question: { name, type: 'A' },
    client: '192.168.1.100',
    clientName: 'test-device',
    blockReason: reason,
    blockRule: '',
  }
}

describe('analyze', () => {
  it('computes slow rate and severe rate correctly', () => {
    const entries = [
      q('example.com', 10),
      q('example.com', 50),
      q('example.com', 100),
      q('example.com', 600),  // slow (>500)
      q('example.com', 2000), // severe (>1000)
    ]

    const stats = analyze(entries)[0].uncached
    expect(stats.slowRate).toBe(2 / 5)   // 600 and 2000 = slow
    expect(stats.severeRate).toBe(1 / 5)  // only 2000 = severe
  })

  it('groups multiple domains correctly', () => {
    const entries = [
      q('alpha.com', 10),
      q('beta.com', 20),
      q('alpha.com', 30),
      q('gamma.com', 40),
    ]

    const result = analyze(entries)
    expect(result).toHaveLength(3)

    const alpha = result.find(s => s.domain === 'alpha.com')!
    expect(alpha.totalCount).toBe(2)
    expect(alpha.uncached.avg).toBe(20)

    const beta = result.find(s => s.domain === 'beta.com')!
    expect(beta.totalCount).toBe(1)

    const gamma = result.find(s => s.domain === 'gamma.com')!
    expect(gamma.totalCount).toBe(1)
  })

  it('returns empty array for empty input', () => {
    expect(analyze([])).toEqual([])
  })

  it('handles single entry', () => {
    const entries = [q('example.com', 42)]
    const stats = analyze(entries)[0]

    expect(stats.domain).toBe('example.com')
    expect(stats.totalCount).toBe(1)
    expect(stats.uncached.min).toBe(42)
    expect(stats.uncached.max).toBe(42)
    expect(stats.uncached.p20).toBe(42)
    expect(stats.uncached.p50).toBe(42)
    expect(stats.uncached.p95).toBe(42)
    expect(stats.uncached.p99).toBe(42)
  })

  it('computes query type distribution', () => {
    const entries = [
      q('example.com', 10, false, 'A'),
      q('example.com', 20, false, 'A'),
      q('example.com', 30, false, 'AAAA'),
      q('example.com', 40, false, 'PTR'),
      q('other.org',   50, false, 'MX'),
    ]

    const result = analyze(entries)
    expect(result).toHaveLength(2)

    const ex = result.find(s => s.domain === 'example.com')!
    expect(ex.queryTypes).toEqual({ A: 2, AAAA: 1, PTR: 1 })

    const other = result.find(s => s.domain === 'other.org')!
    expect(other.queryTypes).toEqual({ MX: 1 })
  })

  it('separates cached and uncached latencies', () => {
    const entries = [
      q('example.com', 2, true),   // cached
      q('example.com', 3, true),   // cached
      q('example.com', 50, false), // uncached
      q('example.com', 150, false),// uncached
    ]

    const stats = analyze(entries)[0]
    expect(stats.totalCount).toBe(4)
    expect(stats.cachedCount).toBe(2)
    expect(stats.cacheHitRate).toBe(0.5)

    // Uncached: only the 2 real upstream queries
    expect(stats.uncached.count).toBe(2)
    expect(stats.uncached.min).toBe(50)
    expect(stats.uncached.max).toBe(150)
    expect(stats.uncached.avg).toBe(100)

    // All: includes cache hits
    expect(stats.all.count).toBe(4)
    expect(stats.all.min).toBe(2)
    expect(stats.all.max).toBe(150)
    expect(stats.all.avg).toBe((2 + 3 + 50 + 150) / 4)
  })

  it('computes percentiles correctly', () => {
    // 1..10 with one outlier 20
    const entries = [
      q('example.com', 1),
      q('example.com', 2),
      q('example.com', 3),
      q('example.com', 4),
      q('example.com', 5),
      q('example.com', 6),
      q('example.com', 7),
      q('example.com', 8),
      q('example.com', 9),
      q('example.com', 10),
      q('example.com', 20),
    ]

    const result = analyze(entries)
    expect(result).toHaveLength(1)

    const u = result[0].uncached
    expect(u.count).toBe(11)
    expect(u.min).toBe(1)
    expect(u.max).toBe(20)
    expect(u.avg).toBeCloseTo(6.818, 3)
    expect(u.p20).toBeCloseTo(3, 2)  // k=2.0 → sorted[2]
    expect(u.p50).toBeCloseTo(6, 2)  // k=5.0 → sorted[5]
    expect(u.p80).toBeCloseTo(9, 2)  // k=8.0 → sorted[8]
    expect(u.p95).toBeCloseTo(15, 2) // k=9.5 → interp sorted[9]/[10]
    expect(u.p99).toBeCloseTo(19, 2) // k=9.9 → interp sorted[9]/[10]
  })

  it('returns domain-stats with correct count/min/max/avg for uncached queries', () => {
    const entries = [
      q('example.com', 12),
      q('example.com', 45),
      q('example.com', 120),
    ]

    const result = analyze(entries)
    expect(result).toHaveLength(1)

    const stats = result[0]
    expect(stats.domain).toBe('example.com')
    expect(stats.totalCount).toBe(3)
    expect(stats.cachedCount).toBe(0)
    expect(stats.cacheHitRate).toBe(0)

    // Unchached stats
    expect(stats.uncached.count).toBe(3)
    expect(stats.uncached.min).toBe(12)
    expect(stats.uncached.max).toBe(120)
    expect(stats.uncached.avg).toBe(59)

    // All stats (same as uncached since no cache)
    expect(stats.all.min).toBe(12)
    expect(stats.all.max).toBe(120)
    expect(stats.all.avg).toBe(59)
  })

  it('computes blockedCount and blockedRate correctly', () => {
    const entries = [
      q('example.com', 10),              // not blocked
      q('example.com', 20),              // not blocked
      blockedQ('example.com', '||blocked.com^'),   // blocked
      blockedQ('example.com', '||blocked.com^'),   // blocked
      blockedQ('example.com', '||other.com^'),     // blocked by different rule
    ]

    const stats = analyze(entries)[0]
    expect(stats.blockedCount).toBe(3)
    expect(stats.blockedRate).toBe(3 / 5)
  })

  it('aggregates topBlockRules correctly', () => {
    const entries = [
      blockedQ('example.com', '||tracker.com^'),
      blockedQ('example.com', '||tracker.com^'),
      blockedQ('example.com', '||tracker.com^'),
      blockedQ('example.com', '||ad.com^'),
      blockedQ('example.com', '||ad.com^'),
      blockedQ('example.com', '||other.com^'),
    ]

    const stats = analyze(entries)[0]
    expect(stats.topBlockRules).toHaveLength(3)

    const top = stats.topBlockRules[0]
    expect(top.rule).toBe('||tracker.com^')
    expect(top.count).toBe(3)

    expect(stats.topBlockRules[1]).toEqual({ rule: '||ad.com^', count: 2 })
    expect(stats.topBlockRules[2]).toEqual({ rule: '||other.com^', count: 1 })
  })

  it('has no topBlockRules when no queries are blocked', () => {
    const entries = [q('example.com', 10), q('example.com', 20)]
    const stats = analyze(entries)[0]
    expect(stats.blockedCount).toBe(0)
    expect(stats.blockedRate).toBe(0)
    expect(stats.topBlockRules).toEqual([])
  })

  it('does not count NotFilteredNotFound/NotFilteredWhiteList as blocked', () => {
    const entries = [
      notFilteredQ('example.com', 'NotFilteredNotFound'),
      notFilteredQ('example.com', 'NotFilteredWhiteList'),
      q('example.com', 10),            // empty blockReason
    ]

    const stats = analyze(entries)[0]
    expect(stats.blockedCount).toBe(0)
    expect(stats.blockedRate).toBe(0)
  })

  it('groups topClients by IP with count', () => {
    const entries = [
      q('google.com', 10),   // client: 192.168.1.100, name: test-device (first occurrence)
      { ...q('google.com', 20), client: '192.168.1.100', clientName: 'macbook' }, // name ignored (already mapped)
      { ...q('google.com', 30), client: '192.168.1.50', clientName: 'iphone' },
      { ...q('google.com', 40), client: '192.168.1.50', clientName: 'iphone' },
      { ...q('google.com', 50), client: '192.168.1.200', clientName: undefined },
    ]

    const stats = analyze(entries)[0]
    expect(stats.topClients).toHaveLength(3)
    expect(stats.topClients[0]).toMatchObject({ ip: '192.168.1.100', name: 'test-device', count: 2 })
    expect(stats.topClients[1]).toMatchObject({ ip: '192.168.1.50', name: 'iphone', count: 2 })
    expect(stats.topClients[2]).toMatchObject({ ip: '192.168.1.200', name: undefined, count: 1 })
  })

  it('returns DomainStats with all required fields', () => {
    const entries = [q('example.com', 42)]
    const stats = analyze(entries)[0]

    expect(stats).toHaveProperty('domain')
    expect(stats).toHaveProperty('totalCount')
    expect(stats).toHaveProperty('cachedCount')
    expect(stats).toHaveProperty('cacheHitRate')
    expect(stats).toHaveProperty('queryTypes')
    expect(stats).toHaveProperty('uncached')
    expect(stats).toHaveProperty('all')
    expect(stats).toHaveProperty('topClients')
    expect(stats).toHaveProperty('blockedCount')
    expect(stats).toHaveProperty('blockedRate')
    expect(stats).toHaveProperty('topBlockRules')
    expect(stats.uncached).toHaveProperty('count')
    expect(stats.uncached).toHaveProperty('min')
    expect(stats.uncached).toHaveProperty('max')
    expect(stats.uncached).toHaveProperty('avg')
    expect(stats.uncached).toHaveProperty('p20')
    expect(stats.uncached).toHaveProperty('p50')
    expect(stats.uncached).toHaveProperty('p60')
    expect(stats.uncached).toHaveProperty('p70')
    expect(stats.uncached).toHaveProperty('p80')
    expect(stats.uncached).toHaveProperty('p95')
    expect(stats.uncached).toHaveProperty('p99')
    expect(stats.uncached).toHaveProperty('slowRate')
    expect(stats.uncached).toHaveProperty('severeRate')
  })

  it('handles multiple clients querying the same domain', () => {
    const entries = [
      { ...q('example.com', 10), client: '192.168.1.10', clientName: 'pc' },
      { ...q('example.com', 20), client: '192.168.1.20', clientName: 'phone' },
      { ...q('example.com', 30), client: '192.168.1.10', clientName: 'pc' },
      { ...q('example.com', 40), client: '192.168.1.30', clientName: 'ipad' },
    ]

    const stats = analyze(entries)[0]
    expect(stats.topClients).toHaveLength(3)
    expect(stats.topClients[0]).toMatchObject({ ip: '192.168.1.10', name: 'pc', count: 2 })
    expect(stats.topClients[1]).toMatchObject({ ip: '192.168.1.20', name: 'phone', count: 1 })
    expect(stats.topClients[2]).toMatchObject({ ip: '192.168.1.30', name: 'ipad', count: 1 })
    expect(stats.totalCount).toBe(4)
  })
})
