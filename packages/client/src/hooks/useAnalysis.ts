import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnalysisSummary, DashboardPayload } from 'shared'
import { isAbortError, sleep } from '../lib/async'

const API_BASE = ''

/**
 * #19 刷新后的轮询等待序列，真指数：1s → 2s → 4s → 8s 之后 8s 封顶。
 * 10 次合计约 63 秒；走完还没 ready 就按超时处理，给用户一条可见提示。
 */
export const POLL_BACKOFF_MS = [1000, 2000, 4000, 8000, 8000, 8000, 8000, 8000, 8000, 8000] as const

export const REFRESH_TIMEOUT_MESSAGE = `刷新超时：后端在 ${Math.round(POLL_BACKOFF_MS.reduce((a, b) => a + b, 0) / 1000)} 秒内没有返回结果，请稍后重试`

interface UseAnalysisResult {
  loading: boolean
  error: string | null
  data: DashboardPayload | null
  refresh: () => Promise<void>
  refreshing: boolean
}

/** 自动恢复上次配置并触发刷新（只在首次加载用） */
function autoRefresh(signal: AbortSignal): Promise<void> {
  const url = localStorage.getItem('adgh_url')
  const user = localStorage.getItem('adgh_user')
  const pass = localStorage.getItem('adgh_pass')
  const timeHours = localStorage.getItem('adgh_time_hours')
  if (!url || !user || !pass) return Promise.resolve()

  const cfg: Record<string, unknown> = {
    baseUrl: url.replace(/\/$/, ''),
    username: user,
    password: pass,
    rejectUnauthorized: false,
  }
  if (timeHours) cfg.timeRangeHours = parseInt(timeHours, 10)

  return fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adguardConfig: cfg }),
    signal,
  })
    .then(() => fetch(`${API_BASE}/api/analysis/refresh`, { method: 'POST', signal }))
    .then(() => {/* done */})
    .catch(() => {/* 首次加载的自动恢复失败不阻塞页面，后续手动刷新会给错误 */})
}

type PollOutcome = 'ready' | 'failed' | 'timeout'

export function useAnalysis(): UseAnalysisResult {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardPayload | null>(null)
  const autoRefreshed = useRef(false)
  /** 当前轮询（或手动刷新）的取消句柄；重入与卸载都会 abort 它 */
  const abortRef = useRef<AbortController | null>(null)

  const fetchDashboard = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API_BASE}/api/analysis/dashboard`, { signal })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const d = await res.json() as DashboardPayload
      if (signal?.aborted) return

      // 报告后端记录的错误
      setError(d.lastError ?? null)
      setData(d)
    } catch (e) {
      if (signal?.aborted || isAbortError(e)) return
      setError(e instanceof Error ? e.message : '连接后端失败')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  /** 轮询到 ready / lastError / 次数用尽，三选一返回 */
  const pollUntilReady = useCallback(async (signal: AbortSignal): Promise<PollOutcome> => {
    for (const wait of POLL_BACKOFF_MS) {
      await sleep(wait, signal)
      const res = await fetch(`${API_BASE}/api/analysis/summary`, { signal })
      const s = await res.json() as AnalysisSummary
      if (s.lastError) {
        setError(s.lastError)
        return 'failed'
      }
      if (s.ready) return 'ready'
    }
    return 'timeout'
  }, [])

  const doRefresh = useCallback(async () => {
    abortRef.current?.abort() // 重入：取消上一轮
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/analysis/refresh`, { method: 'POST', signal: ctrl.signal })
      if (!res.ok) throw new Error(`刷新失败: ${res.status}`)

      const outcome = await pollUntilReady(ctrl.signal)
      if (ctrl.signal.aborted) return
      if (outcome === 'failed') {
        setRefreshing(false)
        return
      }
      if (outcome === 'timeout') {
        setError(REFRESH_TIMEOUT_MESSAGE)
        setRefreshing(false)
        return
      }

      await fetchDashboard(ctrl.signal)
    } catch (e) {
      if (ctrl.signal.aborted || isAbortError(e)) return
      setError(e instanceof Error ? e.message : '刷新失败')
      setRefreshing(false)
    }
  }, [fetchDashboard, pollUntilReady])

  // 初始加载：拉 dashboard，再看缓存新鲜度决定是否自动刷新
  useEffect(() => {
    const ctrl = new AbortController()
    const init = async () => {
      await fetchDashboard(ctrl.signal)
      if (ctrl.signal.aborted) return

      try {
        // 检查缓存新鲜度：5 分钟内的数据直接复用，不触发刷新给 5825u 降温
        const summaryRes = await fetch(`${API_BASE}/api/analysis/summary`, { signal: ctrl.signal })
        const summary = await summaryRes.json() as AnalysisSummary
        if (ctrl.signal.aborted) return
        const lastUpdated = summary.lastUpdated
        const isFresh = lastUpdated !== null && (Date.now() - new Date(lastUpdated).getTime()) < 5 * 60 * 1000

        if (!autoRefreshed.current && localStorage.getItem('adgh_url') && !isFresh) {
          autoRefreshed.current = true
          setLoading(true)
          await autoRefresh(ctrl.signal)
          if (ctrl.signal.aborted) return

          const outcome = await pollUntilReady(ctrl.signal)
          if (ctrl.signal.aborted) return
          if (outcome === 'timeout') {
            setError(REFRESH_TIMEOUT_MESSAGE)
            setLoading(false)
            setRefreshing(false)
            return
          }
          if (outcome === 'failed') {
            setLoading(false)
            setRefreshing(false)
            return
          }
          await fetchDashboard(ctrl.signal)
        }
      } catch (e) {
        if (ctrl.signal.aborted || isAbortError(e)) return
        setError(e instanceof Error ? e.message : '连接后端失败')
        setLoading(false)
      }
    }
    init()
    return () => ctrl.abort()
  }, [fetchDashboard, pollUntilReady])

  // 卸载：手动发起的刷新也要取消（init 那条链有自己的 cleanup）
  useEffect(() => () => {
    abortRef.current?.abort()
  }, [])

  return { loading, error, data, refresh: doRefresh, refreshing }
}