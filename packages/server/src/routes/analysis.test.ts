import { describe, it, expect, beforeAll } from 'vitest'
import { buildApp } from '../app'
import type { FastifyInstance } from 'fastify'
import type { RawFetchedEntry } from '../adguard/client'

let app: FastifyInstance

beforeAll(() => {
  app = buildApp()
})

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body).toHaveProperty('status')
    expect(body.status).toBe('ok')
  })
})

describe('GET /api/analysis/summary', () => {
  it('returns 200 with cache status when no data loaded', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analysis/summary' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.ready).toBe(false)
    expect(body.timeRange).toBeNull()
    expect(body.domainCount).toBe(0)
  })
})

describe('GET /api/analysis/domains', () => {
  it('returns 200 with empty array when no data loaded', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analysis/domains' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('supports search and sort parameters', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analysis/domains?search=test&sort=totalCount&order=asc' })
    expect(res.statusCode).toBe(200)
  })
})

describe('GET /api/analysis/domains/:domain', () => {
  it('returns 200 with domain detail when data available', async () => {
    const entry: RawFetchedEntry = {
      elapsedMs: 10, cached: false, upstream: 'https://dns.cloudflare.com',
      status: 'NOERROR', question: { name: 'example.com', type: 'A' },
      time: '2024-01-01T00:00:00Z',
    }
    const appWithData = buildApp({
      cacheSeed: new Map<string, RawFetchedEntry[]>([
        ['example.com', [
          entry,
          { ...entry, elapsedMs: 200, upstream: 'tls://dns.quad9.net', time: '2024-01-01T00:00:01Z' },
        ]],
      ]),
    })

    const res = await appWithData.inject({ method: 'GET', url: '/api/analysis/domains/example.com' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.domain).toBe('example.com')
    expect(body.entries).toHaveLength(2)
    expect(body.entries[0]).toHaveProperty('elapsedMs')
    expect(body.entries[0]).toHaveProperty('upstream')
    expect(body.upstreams).toHaveLength(2)
  })

  it('returns 404 for unknown domain', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analysis/domains/unknown.com' })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/analysis/refresh', () => {
  it('returns 400 when AdGuardHome not configured', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/analysis/refresh' })
    expect(res.statusCode).toBe(400)
  })
})
