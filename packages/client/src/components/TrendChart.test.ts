import { describe, it, expect } from 'vitest'
import { trimLeadingZeros } from './TrendChart'

describe('trimLeadingZeros', () => {
  it('removes leading entries where queries and blocked are both zero', () => {
    const data = [
      { queries: 0, blocked: 0 },
      { queries: 0, blocked: 0 },
      { queries: 100, blocked: 5 },
      { queries: 200, blocked: 10 },
    ]
    expect(trimLeadingZeros(data)).toEqual([
      { queries: 100, blocked: 5 },
      { queries: 200, blocked: 10 },
    ])
  })

  it('returns data unchanged when first entry is non-zero', () => {
    const data = [
      { queries: 50, blocked: 2 },
      { queries: 100, blocked: 5 },
    ]
    expect(trimLeadingZeros(data)).toBe(data) // same reference
  })

  it('returns data unchanged when all entries are zero (no data yet)', () => {
    const data = [
      { queries: 0, blocked: 0 },
      { queries: 0, blocked: 0 },
    ]
    expect(trimLeadingZeros(data)).toBe(data)
  })

  it('handles empty array', () => {
    expect(trimLeadingZeros([])).toEqual([])
  })

  it('handles single entry with data', () => {
    const data = [{ queries: 10, blocked: 0 }]
    expect(trimLeadingZeros(data)).toBe(data)
  })

  it('handles single zero entry', () => {
    const data = [{ queries: 0, blocked: 0 }]
    expect(trimLeadingZeros(data)).toBe(data)
  })
})
