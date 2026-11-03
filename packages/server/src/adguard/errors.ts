/**
 * D1: Node 的 fetch 失败时 `err.message` 只有 "fetch failed"，真正的原因（ECONNREFUSED、
 * UND_ERR_SOCKET 之类）在 `err.cause` 上。这里把 cause 链上的 `.code` 拼进消息：
 * `fetch failed (ECONNREFUSED)`；没有 cause 或没有 code 时原样返回 message，不凭空加括号。
 *
 * 只沿 cause 链走 2 层：实测 undici 的形状是 TypeError -> Error(code) -> 少量嵌套
 * （AggregateError 时还要看 errors），再往深处是内部包装而不是新信息，多走只会把实现细节
 * 漏进用户可见文案。取的是 `code` 而不是 cause 的 message——code 是常量，不带主机名、
 * 不带请求 URL，也不会夹进凭据。
 */
export function describeFetchError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const code = findCauseCode(err)
  return code ? `${message} (${code})` : message
}

function findCauseCode(err: unknown): string | null {
  let current: unknown = err
  for (let depth = 0; depth < 2; depth++) {
    const cause = (current as { cause?: unknown } | null)?.cause
    if (!cause) return null
    const code = extractCode(cause)
    if (code) return code
    current = cause
  }
  return null
}

function extractCode(value: unknown): string | null {
  const own = (value as { code?: unknown } | null)?.code
  if (typeof own === 'string' && own !== '') return own

  if (value instanceof AggregateError) {
    for (const inner of value.errors) {
      const code = extractCode(inner)
      if (code) return code
    }
  }
  return null
}