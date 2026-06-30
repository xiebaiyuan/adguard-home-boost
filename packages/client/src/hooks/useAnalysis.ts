import { useState, useEffect, useCallback, useRef } from 'react'
import type { DomainStats, AnalysisSummary } from '../lib/types'

const API_BASE = ''

interface UseAnalysisResult {
  loading: boolean
  error: string | null
  summary: AnalysisSummary | null
  domains: DomainStats[]
  refresh: () => Promise<void>
  refreshing: boolean
}

function autoRefresh(): Promise<void> {
  const url = localStorage.getItem('adgh_url')
  const user = localStorage.getItem('adgh_user')
  const pass = localStorage.getItem('adgh_pass')
  if (!url || !user || !pass) return Promise.resolve()

  const cfg = {
    baseUrl: url.replace(/\/$/, ''),
    username: user,
    password: pass,
    rejectUnauthorized: false,
  }

  return fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adguardConfig: cfg }),
  })
    .then(() => fetch(`${API_BASE}/api/analysis/refresh`, { method: 'POST' }))
    .then(() => {/* done */})
    .catch(() => {/* ignore */})
}

export function useAnalysis(): UseAnalysisResult {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [domains, setDomains] = useState<DomainStats[]>([])
  const autoRefreshed = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, domainsRes] = await Promise.all([
        fetch(`${API_BASE}/api/analysis/summary`),
        fetch(`${API_BASE}/api/analysis/domains?limit=500`),
      ])

      if (!summaryRes.ok || !domainsRes.ok) {
        throw new Error(`API error: ${summaryRes.status}`)
      }

      const s = await summaryRes.json() as AnalysisSummary
      setSummary(s)
      setDomains(await domainsRes.json())

      if (s.lastError) {
        setError(s.lastError)
      } else {
        setError(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接后端失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/analysis/refresh`, { method: 'POST' })
      if (!res.ok) throw new Error(`刷新失败: ${res.status}`)

      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const sRes = await fetch(`${API_BASE}/api/analysis/summary`)
        const s = await sRes.json() as AnalysisSummary
        if (s.lastError) {
          setError(s.lastError)
          setRefreshing(false)
          return
        }
        if (s.ready) break
      }

      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '刷新失败')
      setRefreshing(false)
    }
  }, [fetchData])

  // Initial load: fetch summary, then auto-restore + refresh if configured
  useEffect(() => {
    const init = async () => {
      await fetchData()
      if (!autoRefreshed.current && localStorage.getItem('adgh_url')) {
        autoRefreshed.current = true
        setLoading(true)
        await autoRefresh()
        // Wait for refresh to complete
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000))
          const sRes = await fetch(`${API_BASE}/api/analysis/summary`)
          const s = await sRes.json() as AnalysisSummary
          if (s.ready || s.lastError) break
        }
        await fetchData()
      }
    }
    init()
  }, [fetchData])

  return { loading, error, summary, domains, refresh: doRefresh, refreshing }
}
