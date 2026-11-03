import https from 'node:https'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fetchQueryLog } from './client.js'
import { fetchStats } from './stats.js'
import { proxyAdguard } from './proxy.js'
import type { AdguardConfig } from './client.js'

// C8: 自签证书测试上游。证书用 openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=localhost"
// 生成后内联在这里，测试不依赖外部 openssl，也不往仓库写文件。
const TLS_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC0cX5zxVisa5fX
ErG6BJZbkSh9KZLNGvYH6wcOPAv86mFuoF5PD8JEH+aavuLeg6cW9uF28kRr1Z7W
LTihNmy/ax2reyQolTZ9IBd2Z91PArHIMLZiOsGJqIJxMP4G57PzCfZpL/9E3Q2z
SpHQwAsxE62BPgFWrgNpGwH8Y70ZOvxXNDBhfyLBsp3G+PRmqSm+7QRxhSzmYXMe
L6CprUBCzTGdEC7aWBkUTMbEYmDFU9q/3bRnD72QZgDXw649e6m0zuc8t5dXb6ik
fT1OO8t8WPctStyGu67zIf9Vb64JcAF5AWdff2FB9ZA5+EEinaA2TGV5ZAGH7+lW
ZHhkTRVHAgMBAAECggEABamWGhRauJzVWMncyx7/u1BH0/2s/kPwh197V8zPyrHU
OU0aoiKD3Yo4VpAGiiY/5RTKqH/ok8KFYU7T+xy8UH/dBrEuxkzaA+OXUn9NG5o7
CzKaicr/bc5C7nUzufKL3BgEJCYXpAj7BOHvLeM8HRMmaIR4m3uK3qga6aYVNg7T
pBnw+q5O3oYgFDPoTkA5DvGOEEYPkG2IEzFqMcWkizsiP33csAzTn2mo80hhzteR
diWnILEs6X/2DyfbWnuyuQq2iNDDgD7NfGz7T2x4eHE0TQRPXepY37e26Jc5aqqo
xRI67/NXt89QCWxobm63zMkoazqPfZZD1StA+oJC0QKBgQDveAejCX0eD8KwPEA/
pgIw1vNEikV4hr6Thqac7baxeAyGa56HmSQg3qYrbXSiTslaFNSQgsGH50aE0Hko
gxqBAKU+yv01bx1tLj32a9iH+nmpHbyd5Ik1x0LM6D+bRtCQt/6qhx0TKScKOQpk
w8iznz+Iq46hMEuCSAfQGby/qQKBgQDA5libaC3XLqOl2hcFfmOw8APhlVPKXsDC
kr592RxvKmQsGUG7blMBUQApDTi+IuuOnr99ePflg0XUHnRO6mvdAQ9yLllGkjhG
XNILKNHDTnqPYkHK8PPDU65frGF9ZqynyBS8bKbCUJf4wTdSC9YqN+FR3Tixwc1N
qJQbKd8DbwKBgQDuX2gStf5S71NYhRFbik/B+CY+Qvm2aULJrY6qxcJHVH37TKOI
zTt2cMuujQ0+B/lM71FM7KvjMagzyyXf2umGInNbV0rIZuw+43oQkvf/G6kBXDWG
Ypjm7IwlVscCNXKlrFIXw9mAWkWfWnprJaziiJIA5O1crKtta3BDiWsmyQKBgFJz
41oCLN32nJKu5vo9LQWbgj0xZBBzcfd5XB1U6TeHKixDW3pvTOGaKvRhJ2j2ajOb
HYTXaTbcZsOlhNeakiJ0apLGxvhIVe+Vi16jww21hOO2/yJs3fUW1skkWMOOWKya
9GoaEymp41u70xap4pBHNHOWmL46dbQFI9F8k0vXAoGAG+cZ1ubQjrt8wu3Dxw5D
2MsoqdD9na5LnP/GTneoQHNSw/jfQS4YdZ3zY1qXfINc46m9AxtcY5nFK30acPaE
bK/1vM8s27uPFwLWOUjVb5gRMRs3CmcaR2m0P3vApBeOXg7vZUWnXvDeVBHtdBMy
WvnSixQjIFAPBWraYZuMXO0=
-----END PRIVATE KEY-----`

const TLS_CERT = `-----BEGIN CERTIFICATE-----
MIIDBDCCAeygAwIBAgIUUVNQ0eyhssOs8Sx4fTverGmrfSQwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTEwMzEwNTQzNloXDTM2MTAz
MTEwNTQzNlowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAtHF+c8VYrGuX1xKxugSWW5EofSmSzRr2B+sHDjwL/Oph
bqBeTw/CRB/mmr7i3oOnFvbhdvJEa9We1i04oTZsv2sdq3skKJU2fSAXdmfdTwKx
yDC2YjrBiaiCcTD+Buez8wn2aS//RN0Ns0qR0MALMROtgT4BVq4DaRsB/GO9GTr8
VzQwYX8iwbKdxvj0Zqkpvu0EcYUs5mFzHi+gqa1AQs0xnRAu2lgZFEzGxGJgxVPa
v920Zw+9kGYA18OuPXuptM7nPLeXV2+opH09TjvLfFj3LUrchruu8yH/VW+uCXAB
eQFnX39hQfWQOfhBIp2gNkxleWQBh+/pVmR4ZE0VRwIDAQABo04wTDAdBgNVHQ4E
FgQU7Qk2sHolarrY7mXAjY097TYVisQwDwYDVR0TAQH/BAUwAwEB/zAaBgNVHREE
EzARgglsb2NhbGhvc3SHBH8AAAEwDQYJKoZIhvcNAQELBQADggEBAKrHgR7PBZ6T
qOm52ZFGp9OjwIU1v2fpYbyPWTqeM4EmGduV5ickLgcfnHvnh1nfeeHJhd6lTKxY
LnuUOAMtAWBBf2uVNW3vTo/1dt1BUKMKqvYauR7N9Z4vWn4S66VZRNn2T5xjkUdJ
BxH1gg4JVyFfRGxZNxHxoVHavZiQQ0FKaOYYrBcWKuTnDaQZt81RNcPyBfBtMy1r
B2pF7zCNtIJFUlvqOgJrBbixFGv1zr+2RO64cPcyQbY3yWpZyn04S7nAt4iwPLZP
cagxJYTa+0LJjmdQm9CXeJPLANPAh9MAuhZ9DWk20O+pLCjO6otHp220eDyZP/jz
rMnr993MAkk=
-----END CERTIFICATE-----`

const STATS_PAYLOAD = {
  top_queried_domains: [],
  top_clients: [],
  top_blocked_domains: [],
  top_upstreams_responses: [],
  top_upstreams_avg_time: [],
  dns_queries: [],
  blocked_filtering: [],
  num_dns_queries: 0,
  num_blocked_filtering: 0,
  num_replaced_safebrowsing: 0,
  num_replaced_safesearch: 0,
  num_replaced_parental: 0,
  avg_processing_time: 0,
  time_units: 'days',
}

let server: https.Server
let port = 0
let requests: string[] = []

beforeAll(async () => {
  server = https.createServer({ key: TLS_KEY, cert: TLS_CERT }, (req, res) => {
    requests.push(`${req.method} ${req.url}`)
    res.writeHead(200, { 'content-type': 'application/json' })
    if (req.url?.startsWith('/control/querylog')) {
      res.end(JSON.stringify({ oldest: new Date(Date.now() - 2 * 864e5).toISOString(), data: [] }))
      return
    }
    res.end(req.url?.startsWith('/control/stats') ? JSON.stringify(STATS_PAYLOAD) : '{}')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
  port = (server.address() as any).port
})

afterAll(() => {
  server?.close()
})

function config(rejectUnauthorized: boolean): AdguardConfig {
  return { baseUrl: `https://127.0.0.1:${port}`, username: 'u', password: 'p', rejectUnauthorized }
}

/** 取 fetch 失败的底层 TLS 错误码（undici 把它放在 cause 里） */
async function tlsErrorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn()
    return 'no-error'
  } catch (err: any) {
    return err?.cause?.code ?? err?.code ?? err?.message ?? 'unknown'
  }
}

describe('C8 按请求的 TLS 校验（自签证书上游）', () => {
  it('rejectUnauthorized=false 能连上', async () => {
    expect(await fetchQueryLog(config(false))).toEqual([])
    expect(requests.some(r => r.includes('/control/querylog'))).toBe(true)
  })

  it('rejectUnauthorized=true 报自签证书错误（fetchQueryLog）', async () => {
    expect(await tlsErrorCode(() => fetchQueryLog(config(true)))).toBe('DEPTH_ZERO_SELF_SIGNED_CERT')
  })

  it('stats 也吃这个开关：false 通，true 报错', async () => {
    const ok = await fetchStats(config(false))
    expect(ok.totalQueries).toBe(0)
    expect(await tlsErrorCode(() => fetchStats(config(true)))).toBe('DEPTH_ZERO_SELF_SIGNED_CERT')
  })

  it('proxy 也吃这个开关：false 200，true 502', async () => {
    expect((await proxyAdguard(config(false), 'GET', '/status')).status).toBe(200)
    expect((await proxyAdguard(config(true), 'GET', '/status')).status).toBe(502)
  })

  it('整个过程不碰进程级 TLS 环境变量', () => {
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined()
  })
})
