import { useState, useCallback, useEffect } from 'react'

interface FilterInfo {
  id?: number
  name: string
  enabled: boolean
  rulesCount?: number
  url?: string
  lastUpdated?: string
}

interface AdguardStatus {
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

async function adguardGet(path: string): Promise<any> {
  const res = await fetch(`/api/adguard/${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function adguardPost(path: string, body?: any): Promise<any> {
  const res = await fetch(`/api/adguard/${path}`, {
    method: 'POST',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export function useAdguard() {
  const [status, setStatus] = useState<AdguardStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rewrites, setRewrites] = useState<AdguardStatus['rewrites']>([])
  const [saving, setSaving] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, fs, ss, ps, sss, rl] = await Promise.all([
        adguardGet('status'),
        adguardGet('filtering/status'),
        adguardGet('safebrowsing/status'),
        adguardGet('parental/status'),
        adguardGet('safesearch/status'),
        adguardGet('rewrite/list'),
      ])
      setStatus({
        protectionEnabled: s.protection_enabled ?? true,
        version: s.version ?? '',
        filteringEnabled: fs?.enabled ?? true,
        safebrowsingEnabled: ss?.enabled ?? false,
        parentalEnabled: ps?.enabled ?? false,
        safesearch: { enabled: sss?.enabled ?? false, services: sss },
        filters: (fs?.filters ?? []).map((f: any) => ({
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

  const toggleProtection = useCallback(async (enabled: boolean) => {
    setSaving('protection')
    try {
      await adguardPost('protection', { enabled, duration: 0 })
      await refresh()
    } finally { setSaving(null) }
  }, [refresh])

  const clearCache = useCallback(async () => {
    setSaving('cache')
    try { await adguardPost('cache_clear') }
    finally { setSaving(null) }
  }, [])

  const toggleSafebrowsing = useCallback(async (enabled: boolean) => {
    setSaving('safebrowsing')
    try {
      await adguardPost(enabled ? 'safebrowsing/enable' : 'safebrowsing/disable')
      await refresh()
    } finally { setSaving(null) }
  }, [refresh])

  const toggleParental = useCallback(async (enabled: boolean) => {
    setSaving('parental')
    try {
      await adguardPost(enabled ? 'parental/enable' : 'parental/disable')
      await refresh()
    } finally { setSaving(null) }
  }, [refresh])

  const setUserRules = useCallback(async (rules: string) => {
    setSaving('rules')
    try {
      await adguardPost('filtering/set_rules', { rules })
      await refresh()
    } finally { setSaving(null) }
  }, [refresh])

  const addFilterUrl = useCallback(async (name: string, url: string) => {
    setSaving('filter')
    try {
      await adguardPost('filtering/add_url', { name, url })
      await refresh()
    } finally { setSaving(null) }
  }, [refresh])

  const removeFilterUrl = useCallback(async (url: string) => {
    setSaving('filter')
    try {
      await adguardPost('filtering/remove_url', { url })
      await refresh()
    } finally { setSaving(null) }
  }, [refresh])

  const addRewrite = useCallback(async (domain: string, answer: string) => {
    await adguardPost('rewrite/add', { domain, answer })
    await refresh()
  }, [refresh])

  const deleteRewrite = useCallback(async (domain: string, answer: string) => {
    await adguardPost('rewrite/delete', { domain, answer })
    await refresh()
  }, [refresh])

  const resetStats = useCallback(async () => {
    setSaving('reset')
    try { await adguardPost('stats_reset') }
    finally { setSaving(null) }
  }, [])

  const clearLog = useCallback(async () => {
    setSaving('clear')
    try { await adguardPost('querylog_clear') }
    finally { setSaving(null) }
  }, [])

  return {
    status, loading, error, saving,
    rewrites,
    refresh,
    toggleProtection, clearCache,
    toggleSafebrowsing, toggleParental,
    setUserRules, addRewrite, deleteRewrite,
    addFilterUrl, removeFilterUrl,
    resetStats, clearLog,
  }
}
