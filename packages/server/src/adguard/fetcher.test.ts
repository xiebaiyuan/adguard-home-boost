import { createServer } from 'http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { refreshFromAdguard } from './fetcher'
import { analyze } from '../analyze'
import type { Server } from 'http'

let server: Server
let port = 0

const ONE_HOUR_MS = 3600_000

// Generate entries spanning 2 hours with various latencies
const now = new Date('2024-06-30T12:00:00Z')
const entries = Array.from({ length: 25 }, (_, i) => {
  const time = new Date(now.getTime() - i * 5 * 60_000).toISOString() // every 5 min
  const isCached = i % 3 === 0
  return {
    time,
    question: {
      name: i < 10 ? 'example.com' : i < 20 ? 'tracker.org' : 'ads.example.net',
      type: 'A',
    },
    elapsedMs: isCached ? '3.2' : String(20 + Math.random() * 980),
    cached: isCached,
    upstream: isCached ? '' : 'tls://dns.quad9.net',
    status: 'NOERROR',
  }
})

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      const auth = req.headers['authorization']
      const validAuth = 'Basic ' + Buffer.from('admin:password').toString('base64')
      if (auth !== validAuth) {
        res.writeHead(401)
        res.end('{}')
        return
      }

      const url = new URL(req.url!, `http://localhost:${port}`)
      const olderThan = url.searchParams.get('older_than')

      const pageData = olderThan ? [] : entries.map(e => ({
        ...e,
        elapsedMs: String(e.elapsedMs),
      }))

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ oldest: entries[entries.length - 1].time, data: pageData }))
    })
    server.listen(0, () => {
      port = (server.address() as any).port
      resolve()
    })
  })
})

afterAll(() => {
  server?.close()
})

describe('refreshFromAdguard', () => {
  it('fetches data, analyzes it, and returns the results', async () => {
    const result = await refreshFromAdguard({
      baseUrl: `http://localhost:${port}`,
      username: 'admin',
      password: 'password',
      rejectUnauthorized: false,
    })

    expect(result).toHaveProperty('domainStats')
    expect(result).toHaveProperty('rawEntriesByDomain')
    expect(result).toHaveProperty('timeRange')
    expect(result.timeRange).toHaveProperty('start')
    expect(result.timeRange).toHaveProperty('end')

    // Should have found 3 unique domains
    const domains = result.domainStats.map(d => d.domain).sort()
    expect(domains).toEqual(['ads.example.net', 'example.com', 'tracker.org'])

    // Verify raw entries grouped by domain
    expect(result.rawEntriesByDomain.size).toBe(3)
    expect(result.rawEntriesByDomain.get('example.com')?.length).toBe(10)
  })
})
