import type { QueryLogEntry } from 'shared'

export interface AdguardConfig {
  baseUrl: string
  username: string
  password: string
  rejectUnauthorized: boolean
}

/** Raw entry from AdGuardHome that includes the time field */
export interface RawFetchedEntry extends QueryLogEntry {
  time: string
}

interface AdguardApiResponse {
  oldest?: string
  data: ApiLogEntry[]
}

interface ApiLogEntry {
  time: string
  question: { name: string; type: string }
  elapsedMs: string
  cached: boolean
  upstream: string
  status: string
}

const DEFAULT_PAGE_SIZE = 100
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Fetch query log entries from AdGuardHome, paginating through all pages
 * until we've covered the last 24 hours or exhausted all data.
 */
export async function fetchQueryLog(config: AdguardConfig): Promise<RawFetchedEntry[]> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64')

  const allEntries: RawFetchedEntry[] = []
  let olderThan: string | undefined
  let hasMore = true
  const cutoff = new Date(Date.now() - ONE_DAY_MS)

  while (hasMore) {
    const params = new URLSearchParams({ limit: String(DEFAULT_PAGE_SIZE) })
    if (olderThan) params.set('older_than', olderThan)

    const url = `${baseUrl}/control/querylog?${params}`
    const res = await fetch(url, {
      headers: {
        authorization: `Basic ${auth}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AdGuardHome API error ${res.status}: ${body.slice(0, 200)}`)
    }

    const json = (await res.json()) as AdguardApiResponse
    const data = json.data ?? []

    if (data.length === 0) {
      break
    }

    for (const entry of data) {
      allEntries.push({
        elapsedMs: parseFloat(entry.elapsedMs),
        cached: entry.cached,
        upstream: entry.upstream ?? '',
        status: entry.status ?? '',
        question: { name: entry.question.name, type: entry.question.type },
        time: entry.time,
      })
    }

    // Stop if we've reached 24 hours ago
    if (new Date(data[data.length - 1].time) < cutoff) {
      break
    }

    // Set cursor for next page
    olderThan = data[data.length - 1].time
  }

  return allEntries
}
