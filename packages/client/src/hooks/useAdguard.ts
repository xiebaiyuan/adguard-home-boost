import { useState, useCallback, useEffect } from 'react'

/** `/api/adguard/status` */
interface RawStatus {
  protection_enabled?: boolean
  version?: string
}

interface RawFilter {
  id?: number
  name: string
  enabled: boolean
  rulesCount?: number
  url?: string
  lastUpdated?: string
}

/** `/api/adguard/filtering/status` */
interface RawFiltering {
  enabled?: boolean
  filters?: RawFilter[]
  user_rules?: string[]
}

interface RawToggle {
  enabled?: boolean
}

interface RawRewrite {
  domain: string
  answer: string
  enabled: boolean
}

export interface FilterInfo {
  id?: number
  name: string
  enabled: boolean
  rulesCount?: number
  url?: string
  lastUpdated?: string
}

export interface AdguardStatus {
  protectionEnabled: boolean
  version: string
  filteringEnabled: boolean
  safebrowsingEnabled: boolean
  parentalEnabled: boolean
  safesearch: { enabled: boolean; services?: Record<string, boolean> }
  filters: FilterInfo[]
  rewrites: Array<{ domain: string; answer: string; enabled: boolean }>
  userRules: string
}

async function adguardGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/adguard/${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

async function adguardPost<T = unknown>(path: string, body?: unknown): Promise<T | null> {
  const res = await fetch(`/api/adguard/${path}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T | null
}

export function useAdguard() {
  const [status, setStatus] = useState<AdguardStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rewrites, setRewrites] = useState<AdguardStatus['rewrites']>([])
  const [saving, setSaving] = useState<string | null>(null)
  /** #14 动作级错误：和整页的 error 分开，由对话框/工具栏就近显示，失败不再只是控制台一条 unhandled rejection */
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, fs, ss, ps, sss, rl] = await Promise.all([
        adguardGet<RawStatus>('status'),
        adguardGet<RawFiltering>('filtering/status'),
        adguardGet<RawToggle>('safebrowsing/status'),
        adguardGet<RawToggle>('parental/status'),
        adguardGet<RawFiltering & RawToggle>('safesearch/status'),
        adguardGet<RawRewrite[]>('rewrite/list'),
      ])
      const rawFilters = fs?.filters ?? []
      setStatus({
        protectionEnabled: s.protection_enabled ?? true,
        version: s.version ?? '',
        filteringEnabled: fs?.enabled ?? true,
        safebrowsingEnabled: ss?.enabled ?? false,
        parentalEnabled: ps?.enabled ?? false,
        safesearch: { enabled: sss?.enabled ?? false, services: sss as unknown as Record<string, boolean> },
        filters: rawFilters.map(f => ({
          id: f.id,
          name: f.name,
          enabled: f.enabled,
          rulesCount: f.rulesCount,
          url: f.url,
          lastUpdated: f.lastUpdated,
        })),
        userRules: (fs?.user_rules ?? []).join('\n'),
        rewrites: rl ?? [],
      })
      setRewrites(rl ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  /**
   * 统一的动作包装：置 saving → 清上次的 actionError → 执行 → 捕获失败 → 复位 saving。
   * 返回是否成功，调用点据此决定要不要回滚乐观更新。
   */
  const runAction = useCallback(async (label: string, fn: () => Promise<void>): Promise<boolean> => {
    setSaving(label)
    setActionError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setSaving(null)
    }
  }, [])

  const toggleProtection = useCallback(async (enabled: boolean) => {
    // 乐观更新：立即切换 UI，失败再翻回去
    setStatus(prev => (prev ? { ...prev, protectionEnabled: enabled } : prev))
    const ok = await runAction('protection', async () => {
      await adguardPost('protection', { enabled, duration: 0 })
      await refresh()
    })
    if (!ok) setStatus(prev => (prev ? { ...prev, protectionEnabled: !enabled } : prev))
  }, [refresh, runAction])

  const clearCache = useCallback(() => runAction('cache', async () => {
    await adguardPost('cache_clear')
  }), [runAction])

  const toggleSafebrowsing = useCallback((enabled: boolean) => runAction('safebrowsing', async () => {
    await adguardPost(enabled ? 'safebrowsing/enable' : 'safebrowsing/disable')
    await refresh()
  }), [refresh, runAction])

  const toggleParental = useCallback((enabled: boolean) => runAction('parental', async () => {
    await adguardPost(enabled ? 'parental/enable' : 'parental/disable')
    await refresh()
  }), [refresh, runAction])

  const setUserRules = useCallback((rules: string) => runAction('rules', async () => {
    await adguardPost('filtering/set_rules', { rules })
    await refresh()
  }), [refresh, runAction])

  const addFilterUrl = useCallback((name: string, url: string) => runAction('filter', async () => {
    await adguardPost('filtering/add_url', { name, url })
    await refresh()
  }), [refresh, runAction])

  const removeFilterUrl = useCallback((url: string) => runAction('filter', async () => {
    await adguardPost('filtering/remove_url', { url })
    await refresh()
  }), [refresh, runAction])

  const setFilterEnabled = useCallback((url: string, name: string, enabled: boolean) => runAction('filter', async () => {
    await adguardPost('filtering/set_url', { data: { name, url, enabled }, url, whitelist: false })
    await refresh()
  }), [refresh, runAction])

  const updateFilterUrl = useCallback((oldUrl: string, newUrl: string, name: string) => runAction('filter', async () => {
    await adguardPost('filtering/set_url', { data: { name, url: newUrl, enabled: true }, url: oldUrl, whitelist: false })
    await refresh()
  }), [refresh, runAction])

  const addRewrite = useCallback((domain: string, answer: string) => runAction('rewrite', async () => {
    await adguardPost('rewrite/add', { domain, answer })
    await refresh()
  }), [refresh, runAction])

  const deleteRewrite = useCallback((domain: string, answer: string) => runAction('rewrite', async () => {
    await adguardPost('rewrite/delete', { domain, answer })
    await refresh()
  }), [refresh, runAction])

  const resetStats = useCallback(() => runAction('reset', async () => {
    await adguardPost('stats_reset')
  }), [runAction])

  const clearLog = useCallback(() => runAction('clear', async () => {
    await adguardPost('querylog_clear')
  }), [runAction])

  return {
    status, loading, error, saving, actionError,
    rewrites,
    refresh,
    toggleProtection, clearCache,
    toggleSafebrowsing, toggleParental,
    setUserRules, addRewrite, deleteRewrite,
    addFilterUrl, removeFilterUrl, setFilterEnabled, updateFilterUrl,
    resetStats, clearLog,
  }
}

export type AdguardApi = ReturnType<typeof useAdguard>