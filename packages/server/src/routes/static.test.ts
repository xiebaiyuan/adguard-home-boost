import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'

/**
 * C14: 生产模式下 @fastify/static（10.x）的静态服务回归。
 * 基线来自第一批验收脚本 artifacts/verify-batch1.sh 在 9.x 上记录的行为：
 *   GET / 无凭据 → 401；GET / 有凭据 → 200；GET /assets/<css> 无凭据 → 401。
 * 这里逐条重验，并把产物文件名在运行时取（构建后 hash 会变，不能写死）。
 */
const CLIENT_DIST = resolve(import.meta.dirname, '../../../client/dist')
const AUTH_USER = 'gate-user'
const AUTH_PASS = 'gate-pass'
const basic = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

const ENV_KEYS = ['ADGH_AUTH_USER', 'ADGH_AUTH_PASSWD', 'NODE_ENV'] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]])) as Record<string, string | undefined>

let app: FastifyInstance
let cssAsset = ''

beforeAll(() => {
  process.env.NODE_ENV = 'production'
  process.env.ADGH_AUTH_USER = AUTH_USER
  process.env.ADGH_AUTH_PASSWD = AUTH_PASS
  cssAsset = readdirSync(resolve(CLIENT_DIST, 'assets')).find(f => f.endsWith('.css')) ?? ''
  app = buildApp()
})

afterAll(async () => {
  await app?.close()
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

const authHeader = { authorization: basic(AUTH_USER, AUTH_PASS) }
const get = (url: string, authed = false) =>
  app.inject({ method: 'GET', url, headers: authed ? authHeader : undefined })

describe('C14 生产模式静态服务（@fastify/static 10.x）', () => {
  it('前置：产物目录里有真实 css 资产', () => {
    expect(cssAsset).toMatch(/\.css$/)
  })

  it('/ 无凭据 401；有凭据 200 且返回 index.html', async () => {
    expect((await get('/')).statusCode).toBe(401)

    const res = await get('/', true)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body.toLowerCase()).toContain('<!doctype html>')
  })

  it('/index.html 有凭据 200', async () => {
    const res = await get('/index.html', true)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
  })

  it('/assets/<真实文件> 无凭据 401；有凭据 200 且 content-type 对得上', async () => {
    expect((await get(`/assets/${cssAsset}`)).statusCode).toBe(401)

    const res = await get(`/assets/${cssAsset}`, true)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/css')
    expect(res.rawPayload.length).toBeGreaterThan(100)
  })

  it('SPA 深链不回退 index.html：未知路径有凭据 404、无凭据仍先 401', async () => {
    expect((await get('/some/nonexistent/route')).statusCode).toBe(401)

    const res = await get('/some/nonexistent/route', true)
    // 如实锁定现状：注册里没有 setNotFoundHandler，所以深链是 404 而不是 index.html
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('<!doctype html>')
  })

  it('大小写别名与编码穿越都不被当文件送出（403/404，不是 200）', async () => {
    const upperCaseAlias = await get('/INDEX.HTML', true)
    expect([403, 404]).toContain(upperCaseAlias.statusCode)

    const traversal = await get('/%2e%2e%2fpackage.json', true)
    expect([403, 404]).toContain(traversal.statusCode)
  })
})