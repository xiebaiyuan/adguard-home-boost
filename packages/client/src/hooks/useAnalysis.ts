import { useState, useEffect, useCallback } from 'react'
import type { DomainStats, AnalysisSummary } from '../lib/types'

const API_BASE = ''

interface UseAnalysisResult {
  loading: boolean
  error: string | null
  summary: AnalysisSummary | null
  domains: DomainStats[]
  refresh: () => void
  refreshing: boolean
}

export function useAnalysis(): UseAnalysisResult {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [domains, setDomains] = useState<DomainStats[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, domainsRes] = await Promise.all([
        fetch(`${API_BASE}/api/analysis/summary`),
        fetch(`${API_BASE}/api/analysis/domains`),
      ])

      if (!summaryRes.ok || !domainsRes.ok) {
        throw new Error(`API error: ${summaryRes.status}`)
      }

      const s = await summaryRes.json() as AnalysisSummary
      setSummary(s)
      setDomains(await domainsRes.json())

      // Show backend error if present
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

  const refresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/analysis/refresh`, { method: 'POST' })
      if (!res.ok) throw new Error(`刷新失败: ${res.status}`)

      // Poll summary until ready (or error), max 30s
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

  useEffect(() => { fetchData() }, [fetchData])

  return { loading, error, summary, domains, refresh, refreshing }
}
