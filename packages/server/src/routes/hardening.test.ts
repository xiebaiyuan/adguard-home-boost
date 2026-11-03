import { createServer } from 'http'
import type { Server } from 'http'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'
import { normalizeControlPath, proxyAdguard } from '../adguard/proxy.js'
import type { AdguardConfig } from '../adguard/client.js'

const AUTH_USER = 'gate-user'
const AUTH_PASS = 'gate-pass'
const basic = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64')

const ENV_KEYS = ['ADGH_AUTH_USER', 'ADGH_AUTH_PASSWD', 'NODE_ENV', 'ADGH_DEBUG'] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]])) as Record<string, string | undefined>

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

/** 配好准入凭据再建 app（C1） */
function appWithAuth() {
  process.env.ADGH_AUTH_USER = AUTH_USER
  process.env.ADGH_AUTH_PASSWD = AUTH_PASS
  return buildApp()
}

interface Upstream {
  port: number
  requests: string[]
  close: () => void
}

/** 本地 echo 上游，记录收到的每条请求行 */
async function startUpstream(redirectTo?: string): Promise<Upstream> {
  const requests: string[] = []
  const server: Server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`)
    if (redirectTo) {
      res.writeHead(302, { location: redirectTo })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"ok":true}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  return {
    port: (server.address() as any).port,
    requests,
    close: () => server.close(),
  }
}

function configFor(port: number): AdguardConfig {
  return { baseUrl: `http://127.0.0.1:${port}`, username: 'u', password: 'p', rejectUnauthorized: true }
}

describe('C1 HTTP Basic 准入鉴权', () => {
  it('不带 Authorization 访问 /api/health 返回 401 且带 WWW-Authenticate', async () => {
    const app = appWithAuth()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(401)
    expect(res.headers['www-authenticate']).toBe('Basic realm="adguard-home-boost"')
    await app.close()
  })

  it('正确 Basic 访问 /api/health 与 /api/analysis/summary 返回 200', async () => {
    const app = appWithAuth()
    const health = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: basic(AUTH_USER, AUTH_PASS) },
    })
    expect(health.statusCode).toBe(200)
    expect(JSON.parse(health.body).status).toBe('ok')

    const summary = await app.inject({
      method: 'GET',
      url: '/api/analysis/summary',
      headers: { authorization: basic(AUTH_USER, AUTH_PASS) },
    })
    expect(summary.statusCode).toBe(200)
    await app.close()
  })

  it('错误用户名或密码返回 401', async () => {
    const app = appWithAuth()
    const wrongPass = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: basic(AUTH_USER, 'nope') },
    })
    expect(wrongPass.statusCode).toBe(401)

    const wrongUser = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: basic('nope', AUTH_PASS) },
    })
    expect(wrongUser.statusCode).toBe(401)
    await app.close()
  })

  it('Authorization 格式非法返回 401', async () => {
    const app = appWithAuth()
    const notBasic = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: `Bearer ${basic(AUTH_USER, AUTH_PASS)}` },
    })
    expect(notBasic.statusCode).toBe(401)

    const noColon = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: `Basic ${Buffer.from('nocolon').toString('base64')}` },
    })
    expect(noColon.statusCode).toBe(401)

    const emptyValue = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { authorization: 'Basic ' },
    })
    expect(emptyValue.statusCode).toBe(401)
    await app.close()
  })

  it('未配凭据时不鉴权，/api/health 返回 200', async () => {
    delete process.env.ADGH_AUTH_USER
    delete process.env.ADGH_AUTH_PASSWD
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('NODE_ENV=production 下静态资源同样要求 Basic', async () => {
    process.env.NODE_ENV = 'production'
    const app = appWithAuth()

    const anonymous = await app.inject({ method: 'GET', url: '/index.html' })
    expect(anonymous.statusCode).toBe(401)

    const authorized = await app.inject({
      method: 'GET',
      url: '/index.html',
      headers: { authorization: basic(AUTH_USER, AUTH_PASS) },
    })
    expect(authorized.statusCode).toBe(200)

    const rootAnonymous = await app.inject({ method: 'GET', url: '/' })
    expect(rootAnonymous.statusCode).toBe(401)

    const rootAuthorized = await app.inject({
      method: 'GET',
      url: '/',
      headers: { authorization: basic(AUTH_USER, AUTH_PASS) },
    })
    expect(rootAuthorized.statusCode).toBe(200)
    await app.close()
  })
})

// C3 穿越向量表：每一个都必须 404，且上游一个请求都收不到
const TRAVERSAL_VECTORS = [
  '%2e%2e%2f..%2flogin.html',
  '..%2f..%2flogin.html',
  '%252e%252e%2flogin.html',
  '%25252e%25252e/login.html',
  '..%5c..%5clogin.html',
  '.%09./.%09./login.html',
]

describe('C3 /api/adguard/* 路径白名单', () => {
  for (const vector of TRAVERSAL_VECTORS) {
    it(`穿越向量 ${vector} 返回 404 且上游零请求`, async () => {
      const upstream = await startUpstream()
      const app = buildApp({ adguardConfig: configFor(upstream.port) })
      const res = await app.inject({ method: 'GET', url: `/api/adguard/${vector}` })
      expect(res.statusCode).toBe(404)
      expect(upstream.requests).toEqual([])
      await app.close()
      upstream.close()
    })
  }

  it('第一道放行的中间字符串由第二道按 URL 解析结果拒掉', async () => {
    const upstream = await startUpstream()
    const result = await proxyAdguard(configFor(upstream.port), 'GET', '%252e%252e/login.html')
    expect(result.status).toBe(404)
    expect(upstream.requests).toEqual([])
    upstream.close()
  })

  it('baseUrl 带路径前缀时按该前缀判定：不误杀，越界仍拒', async () => {
    const upstream = await startUpstream()
    const app = buildApp({
      adguardConfig: {
        baseUrl: `http://127.0.0.1:${upstream.port}/prefix`,
        username: 'u',
        password: 'p',
        rejectUnauthorized: true,
      },
    })

    const ok = await app.inject({ method: 'GET', url: '/api/adguard/status' })
    expect(ok.statusCode).toBe(200)
    expect(upstream.requests).toEqual(['GET /prefix/control/status'])

    const escaped = await app.inject({ method: 'GET', url: '/api/adguard/%252e%252e/x' })
    expect(escaped.statusCode).toBe(404)
    expect(upstream.requests).toHaveLength(1)
    await app.close()
    upstream.close()
  })

  it('合法路径放行，query 串一起转发', async () => {
    const upstream = await startUpstream()
    const app = buildApp({ adguardConfig: configFor(upstream.port) })
    const res = await app.inject({ method: 'GET', url: '/api/adguard/filtering/status?a=1&b=2' })
    expect(res.statusCode).toBe(200)
    expect(upstream.requests).toEqual(['GET /control/filtering/status?a=1&b=2'])
    await app.close()
    upstream.close()
  })

  it('上游 302 不被跟随', async () => {
    const target = await startUpstream()
    const upstream = await startUpstream(`http://127.0.0.1:${target.port}/x`)
    const app = buildApp({ adguardConfig: configFor(upstream.port) })
    const res = await app.inject({ method: 'GET', url: '/api/adguard/status' })
    expect(res.statusCode).toBe(302)
    expect(target.requests).toEqual([])
    await app.close()
    upstream.close()
    target.close()
  })
})

describe('C3 normalizeControlPath', () => {
  it('反斜杠与 tab 先按 URL 解析器口径处理，再消 ..', () => {
    expect(normalizeControlPath('/..\\..\\login.html')).toBeNull()
    expect(normalizeControlPath('/.\t./.\t./login.html')).toBeNull()
    expect(normalizeControlPath('/../../login.html')).toBeNull()
  })

  it('合法路径补上 /control 前缀，段内 .. 就地消掉', () => {
    expect(normalizeControlPath('/filtering/status')).toBe('/control/filtering/status')
    expect(normalizeControlPath('/foo/../bar')).toBe('/control/bar')
  })

  it('多重编码的 %2e%2e 段第一道看不出来，只有 URL 解析器会当双点段处理', () => {
    expect(normalizeControlPath('%252e%252e/login.html')).toBe('/control/%2e%2e/login.html')
    expect(new URL('http://h/control/%2e%2e/login.html').pathname).toBe('/login.html')
  })
})

describe('C4 POST /api/config baseUrl 校验', () => {
  const post = (app: ReturnType<typeof buildApp>, payload?: unknown) =>
    app.inject({ method: 'POST', url: '/api/config', payload: payload as any })

  it('ftp:// 协议返回 400', async () => {
    const app = buildApp()
    const res = await post(app, { adguardConfig: { baseUrl: 'ftp://host', username: 'u', password: 'p' } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('baseUrl 带 userinfo 返回 400', async () => {
    const app = buildApp()
    const res = await post(app, { adguardConfig: { baseUrl: 'http://u:p@host', username: 'u', password: 'p' } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('无法解析的 URL 返回 400', async () => {
    const app = buildApp()
    const res = await post(app, { adguardConfig: { baseUrl: 'http://', username: 'u', password: 'p' } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('空 body 返回 400 而不是 500', async () => {
    const app = buildApp()
    const noPayload = await post(app)
    expect(noPayload.statusCode).toBe(400)

    const emptyObject = await post(app, {})
    expect(emptyObject.statusCode).toBe(400)
    await app.close()
  })

  it('缺 username 返回 400', async () => {
    const app = buildApp()
    const res = await post(app, { adguardConfig: { baseUrl: 'http://host', password: 'p' } })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  it('字段类型不对返回 400', async () => {
    const app = buildApp()
    const badUser = await post(app, { adguardConfig: { baseUrl: 'http://host', username: 1, password: 'p' } })
    expect(badUser.statusCode).toBe(400)

    const badRange = await post(app, {
      adguardConfig: { baseUrl: 'http://host', username: 'u', password: 'p', timeRangeHours: '24' },
    })
    expect(badRange.statusCode).toBe(400)
    await app.close()
  })

  it('合法 baseUrl 补 http:// 后返回 200', async () => {
    const app = buildApp()
    const res = await post(app, {
      adguardConfig: { baseUrl: '192.168.1.10:3000', username: 'u', password: 'p', rejectUnauthorized: true },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).adguardUrl).toBe('http://192.168.1.10:3000')
    await app.close()
  })
})

describe('C5 调试接口', () => {
  it('NODE_ENV=production 时 /api/debug/cache-check 不存在', async () => {
    process.env.NODE_ENV = 'production'
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/debug/cache-check' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('NODE_ENV 非 production 时 /api/debug/cache-check 可用', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/debug/cache-check' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})