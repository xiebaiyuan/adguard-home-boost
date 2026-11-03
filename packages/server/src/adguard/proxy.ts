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
  query?: string,
): Promise<ProxyResult> {
  // C3 第一道：归一化并白名单校验，拒绝越出 /control/ 的路径
  const targetPath = normalizeControlPath(path)
  if (!targetPath) {
    return { status: 404, data: { error: 'not found' } }
  }

  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  const url = `${baseUrl}${targetPath}${query ? `?${query}` : ''}`

  // C3 第二道：按 URL 解析器的最终结果判定。编码层数不固定，`%2e%2e`、`.%2e` 这类
  // double-dot 段的变体只在解析器里才现形；中间字符串判不出来，只有 pathname 说了算。
  let parsedUrl: URL
  let controlPrefix: string
  try {
    parsedUrl = new URL(url)
    controlPrefix = `${new URL(baseUrl).pathname.replace(/\/$/, '')}/control/`
  } catch {
    return { status: 404, data: { error: 'not found' } }
  }
  if (!parsedUrl.pathname.startsWith(controlPrefix)) {
    return { status: 404, data: { error: 'not found' } }
  }

  const headers: Record<string, string> = {
    authorization: `Basic ${auth}`,
    accept: 'application/json',
  }

  const opts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(15_000),
    redirect: 'manual',
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

/**
 * C3: 把 wildcard 段归一化成 `/control/...`。
 * decodeURIComponent 后先按 URL 解析器的口径做等价处理（去掉 tab/LF/CR，`\` 当 `/`），
 * 否则 `%5c` / `%09` 拼出的 `..` 会在 fetch 里重新变成目录跳转。
 * 再按 `/` 切段，用栈消掉 `.` 与 `..`；`..` 想弹出空栈（即越出 /control/）返回 null，
 * 结果不以 `/control/` 开头也返回 null。
 */
export function normalizeControlPath(rawWildcard: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(rawWildcard)
  } catch {
    return null
  }

  const cleaned = decoded.replace(/[\t\n\r]/g, '').replace(/\\/g, '/')

  const segments: string[] = []
  for (const segment of cleaned.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return null
      segments.pop()
      continue
    }
    segments.push(segment)
  }

  const path = `/control/${segments.join('/')}`
  return path.startsWith('/control/') ? path : null
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
