import type { AdguardConfig } from './client.js'

interface ProxyResult {
  status: number
  data: any
}

export async function proxyAdguard(
  config: AdguardConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<ProxyResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  const url = `${baseUrl}/control${path}`
  const headers: Record<string, string> = {
    authorization: `Basic ${auth}`,
    accept: 'application/json',
  }

  const opts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(15_000),
  }

  if (body !== undefined && method !== 'GET') {
    headers['content-type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }

  try {
    const res = await fetch(url, opts)
    const text = await res.text()
    const data = text ? safeParse(text) : null
    return { status: res.status, data }
  } catch (err) {
    return { status: 502, data: { error: err instanceof Error ? err.message : String(err) } }
  }
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
