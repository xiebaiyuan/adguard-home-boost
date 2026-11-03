import { createServer } from 'http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fetchQueryLog } from './client.js'
import type { Server } from 'http'

let server: Server
let port = 0

const mockData = [
  {
    time: '2024-01-01T10:00:00Z',
    question: { name: 'example.com', type: 'A' },
    elapsedMs: '12.5',
    cached: false,
    upstream: 'tls://dns.quad9.net',
    status: 'NOERROR',
  },
  {
    time: '2024-01-01T10:00:01Z',
    question: { name: 'example.com', type: 'AAAA' },
    elapsedMs: '3.1',
    cached: true,
    upstream: '',
    status: 'NOERROR',
  },
  {
    time: '2024-01-01T10:00:02Z',
    question: { name: 'tracker.example.org', type: 'A' },
    elapsedMs: '850.2',
    cached: false,
    upstream: 'https://dns.cloudflare.com',
    status: 'NOERROR',
  },
]

let callCount = 0

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = createServer((req, res) => {
      callCount++

      // Check auth header
      const auth = req.headers['authorization']
      const validAuth = 'Basic ' + Buffer.from('admin:password').toString('base64')

      if (auth !== validAuth) {
        res.writeHead(401, { 'www-authenticate': 'Basic' })
        res.end(JSON.stringify({ error: 'unauthorized' }))
        return
      }

      const url = new URL(req.url!, `http://localhost:${port}`)
      const olderThan = url.searchParams.get('older_than')

      const response = {
        oldest: '2024-01-01T00:00:00Z',
        data: olderThan ? [] : mockData,
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(response))
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

const config = () => ({
  baseUrl: `http://localhost:${port}`,
  username: 'admin',
  password: 'password',
  rejectUnauthorized: false,
})

describe('fetchQueryLog', () => {
  it('returns query log entries from AdGuardHome', async () => {
    const result = await fetchQueryLog(config())

    expect(result).toHaveLength(3)
    expect(result[0].elapsedMs).toBeCloseTo(12.5)
    expect(result[0].cached).toBe(false)
    expect(result[0].question.name).toBe('example.com')
    expect(result[0].question.type).toBe('A')
    expect(result[0].upstream).toBe('tls://dns.quad9.net')
    expect(result[0].status).toBe('NOERROR')
    expect(result[0]).toHaveProperty('time')
    expect(result[0].time).toBe('2024-01-01T10:00:00Z')

    expect(result[1].cached).toBe(true)
    expect(result[1].elapsedMs).toBeCloseTo(3.1)

    expect(result[2].question.name).toBe('tracker.example.org')
    expect(result[2].elapsedMs).toBeCloseTo(850.2)
  })

  it('paginates through all pages', async () => {
    callCount = 0
    await fetchQueryLog(config())
    expect(callCount).toBeGreaterThanOrEqual(1)
  })

  it('throws on auth failure', async () => {
    await expect(
      fetchQueryLog({
        ...config(),
        username: 'bad',
        password: 'bad',
      })
    ).rejects.toThrow(/401|unauthorized/i)
  })
})

describe('ADGH_DEBUG 门控 [DEBUG] 日志', () => {
  afterEach(() => {
    delete process.env.ADGH_DEBUG
    vi.restoreAllMocks()
  })

  const debugLines = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter(args => String(args[0]).includes('[DEBUG]'))

  it('ADGH_DEBUG 未设时一条 [DEBUG] 都不打', async () => {
    delete process.env.ADGH_DEBUG
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await fetchQueryLog(config())
    expect(debugLines(spy as any)).toHaveLength(0)
  })

  it('ADGH_DEBUG=1 时打出 [DEBUG]', async () => {
    process.env.ADGH_DEBUG = '1'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await fetchQueryLog(config())
    expect(debugLines(spy as any).length).toBeGreaterThan(0)
  })
})
