import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

const ENV_KEYS = ['ADGH_ALLOWED_HOSTS', 'APP_VERSION'] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]])) as Record<string, string | undefined>

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

function postConfig(app: FastifyInstance, baseUrl: string) {
  return app.inject({
    method: 'POST',
    url: '/api/config',
    payload: { adguardConfig: { baseUrl, username: 'u', password: 'p', rejectUnauthorized: true } },
  })
}

describe('#2 baseUrl 主机白名单：默认策略（未设 ADGH_ALLOWED_HOSTS）', () => {
  it('公网地址被 400 拒', async () => {
    delete process.env.ADGH_ALLOWED_HOSTS
    const app = buildApp()
    const res = await postConfig(app, 'http://8.8.8.8:3000')
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toContain('host is not allowed')
    await app.close()
  })

  it('RFC1918 私网地址仍可通过', async () => {
    delete process.env.ADGH_ALLOWED_HOSTS
    const app = buildApp()
    const res = await postConfig(app, 'http://192.168.1.88:3000')
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).adguardUrl).toBe('http://192.168.1.88:3000')
    await app.close()
  })

  it('回环地址仍可通过', async () => {
    delete process.env.ADGH_ALLOWED_HOSTS
    const app = buildApp()
    expect((await postConfig(app, 'http://127.0.0.1:3000')).statusCode).toBe(200)
    expect((await postConfig(app, 'http://localhost:3000')).statusCode).toBe(200)
    await app.close()
  })

  it('IPv6 回环与 ULA 可通过（URL 里带方括号）', async () => {
    delete process.env.ADGH_ALLOWED_HOSTS
    const app = buildApp()
    expect((await postConfig(app, 'http://[::1]:3000')).statusCode).toBe(200)
    expect((await postConfig(app, 'http://[fd00::1]:3000')).statusCode).toBe(200)
    await app.close()
  })

  it('云元数据地址被拒', async () => {
    delete process.env.ADGH_ALLOWED_HOSTS
    const app = buildApp()
    const res = await postConfig(app, 'http://169.254.169.254')
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})

describe('#2 ADGH_ALLOWED_HOSTS 显式设置时替换默认名单', () => {
  it('写进名单的公网主机放行，未列出的私网与回环反而被拒', async () => {
    process.env.ADGH_ALLOWED_HOSTS = 'ag.example.com'
    const app = buildApp()
    expect((await postConfig(app, 'http://ag.example.com:3000')).statusCode).toBe(200)
    expect((await postConfig(app, 'http://192.168.1.88:3000')).statusCode).toBe(400)
    expect((await postConfig(app, 'http://127.0.0.1:3000')).statusCode).toBe(400)
    await app.close()
  })
})

describe('N1 400 响应不回显原始 baseUrl', () => {
  // 夹具里的一段 userinfo，只用于断言「响应体不含它」
  const USERINFO = 'fixture-' + 'userinfo' + '-value'

  it('畸形 URL 里带 userinfo 时，响应体不含凭据也不含原始输入', async () => {
    const app = buildApp()
    const res = await postConfig(app, `http://user:${USERINFO}@`)
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('baseUrl is not a valid URL')
    expect(res.body).not.toContain(USERINFO)
    expect(res.body).not.toContain('http://')
    await app.close()
  })
})