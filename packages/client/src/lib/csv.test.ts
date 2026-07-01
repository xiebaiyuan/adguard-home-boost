import { describe, it, expect } from 'vitest'
import { exportDomainCsv } from './csv'

describe('exportDomainCsv', () => {
  it('should produce CSV header and row for basic entries', () => {
    const entries = [
      {
        time: '2025-06-01T10:00:00Z',
        elapsedMs: 45,
        cached: false,
        upstream: 'tls://1.1.1.1',
        status: 'NOERROR',
        type: 'A',
        answer: [{ type: 'A', value: '1.2.3.4' }],
      },
    ]

    const csv = exportDomainCsv(entries)

    const lines = csv.trim().split('\n')
    expect(lines.length).toBe(2) // header + 1 row
    expect(lines[0]).toBe('time,elapsedMs,cached,upstream,status,type,answer')
    expect(lines[1]).toContain('2025-06-01T10:00:00Z')
    expect(lines[1]).toContain('45')
    expect(lines[1]).toContain('false')
    expect(lines[1]).toContain('tls://1.1.1.1')
    expect(lines[1]).toContain('NOERROR')
    expect(lines[1]).toContain('A')
    expect(lines[1]).toContain('1.2.3.4')
  })

  it('should produce only header when entries are empty', () => {
    const csv = exportDomainCsv([])
    expect(csv.trim()).toBe('time,elapsedMs,cached,upstream,status,type,answer')
  })

  it('should join multiple answers with semicolons', () => {
    const entries = [
      {
        time: '2025-06-01T10:00:00Z',
        elapsedMs: 12,
        cached: true,
        upstream: '',
        status: 'NOERROR',
        type: 'A',
        answer: [
          { type: 'A', value: '1.1.1.1' },
          { type: 'A', value: '2.2.2.2' },
        ],
      },
    ]

    const csv = exportDomainCsv(entries)
    expect(csv).toContain('1.1.1.1; 2.2.2.2')
  })

  it('should handle entries with no answer', () => {
    const entries = [
      {
        time: '2025-06-01T10:00:00Z',
        elapsedMs: 500,
        cached: false,
        upstream: 'tls://8.8.8.8',
        status: 'NXDOMAIN',
        type: 'AAAA',
        answer: [],
      },
    ]

    const csv = exportDomainCsv(entries)
    const lastComma = csv.lastIndexOf(',')
    const answerCol = csv.slice(lastComma + 1).trim()
    expect(answerCol).toBe('')
  })
})
