import { FileCsv, ArrowClockwise, Gear, ChatCircleText } from '@phosphor-icons/react'
import { useState, useEffect, useRef } from 'react'
import { useAnalysis } from '../hooks/useAnalysis'
import { KpiCards } from './KpiCards'
import { LatencyChart } from './LatencyChart'
import { DomainTable } from './DomainTable'
import { StatsPanel } from './StatsPanel'
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from './Skeleton'
import { SettingsDialog } from './SettingsDialog'
import { exportCsv } from '../lib/csv'
import { buildPrompt, copyToClipboard } from '../lib/prompt'

export function Dashboard() {
  const { loading, error, summary, domains, refresh, refreshing } = useAnalysis()
  const [showSettings, setShowSettings] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRef = useRef(autoRefresh)
  autoRef.current = autoRefresh

  useEffect(() => {
    if (!autoRefresh || refreshing || !summary?.ready) return

    // Recursive setTimeout: schedule next cycle only after current refresh
    const timeout = 5 * 60 * 1000 // 5 分钟
    let timer: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      timer = setTimeout(async () => {
        await refresh()
        if (autoRef.current) scheduleNext()
      }, timeout)
    }

    scheduleNext()

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [autoRefresh, refreshing, summary?.ready, refresh])

  const totalCount = domains.reduce((s, d) => s + d.totalCount, 0)
  const totalCached = domains.reduce((s, d) => s + d.cachedCount, 0)
  const overallCacheRate = totalCount > 0 ? totalCached / totalCount : 0

  const allUncached = domains.map(d => d.uncached)
  const allAll = domains.map(d => d.all)
  const overallUncached = allUncached.length > 0 ? (() => {
    const totalC = allUncached.reduce((s, l) => s + l.count, 0)
    const slowC = allUncached.reduce((s, l) => s + l.slowRate * l.count, 0)
    const severeC = allUncached.reduce((s, l) => s + l.severeRate * l.count, 0)
    const p50s = [...allUncached].sort((a, b) => a.p50 - b.p50)
    const p95s = [...allUncached].sort((a, b) => a.p95 - b.p95)
    return {
      count: totalC,
      min: Math.min(...allUncached.map(l => l.min)),
      max: Math.max(...allUncached.map(l => l.max)),
      avg: allUncached.reduce((s, l) => s + l.avg * l.count, 0) / totalC,
      p20: 0, p50: p50s[Math.floor(p50s.length / 2)]?.p50 ?? 0,
      p80: 0, p95: p95s[Math.floor(p95s.length * 0.95)]?.p95 ?? 0,
      p99: 0,
      slowRate: totalC > 0 ? slowC / totalC : 0,
      severeRate: totalC > 0 ? severeC / totalC : 0,
    }
  })() : null

  const overallAll = allAll.length > 0 ? (() => {
    const totalC = allAll.reduce((s, l) => s + l.count, 0)
    const slowC = allAll.reduce((s, l) => s + l.slowRate * l.count, 0)
    const severeC = allAll.reduce((s, l) => s + l.severeRate * l.count, 0)
    const p50s = [...allAll].sort((a, b) => a.p50 - b.p50)
    const p95s = [...allAll].sort((a, b) => a.p95 - b.p95)
    return {
      count: totalC,
      min: Math.min(...allAll.map(l => l.min)),
      max: Math.max(...allAll.map(l => l.max)),
      avg: allAll.reduce((s, l) => s + l.avg * l.count, 0) / totalC,
      p20: 0, p50: p50s[Math.floor(p50s.length / 2)]?.p50 ?? 0,
      p80: 0, p95: p95s[Math.floor(p95s.length * 0.95)]?.p95 ?? 0,
      p99: 0,
      slowRate: totalC > 0 ? slowC / totalC : 0,
      severeRate: totalC > 0 ? severeC / totalC : 0,
    }
  })() : null

  const handleExport = () => {
    if (!domains.length) return
    exportCsv(domains)
  }

  const [copyOk, setCopyOk] = useState(false)
  const handleCopy = async () => {
    const text = buildPrompt(summary, domains)
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Error banner */}
      {error && (
        <div
          className="mb-5 rounded-lg border px-4 py-3 text-sm fade-in"
          style={{ borderColor: 'var(--c-danger)', background: 'oklch(0.58 0.22 27 / 0.08)', color: 'var(--c-danger)' }}
        >
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="glass-card mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 rounded-full" style={{ background: summary?.ready ? 'var(--c-success)' : 'var(--c-text-secondary)' }} />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text)' }}>
            {summary?.ready ? '分析就绪' : '等待数据'}
          </span>
          {summary?.adguardUrl && (
            <span className="hidden text-xs sm:inline" style={{ color: 'var(--c-text-secondary)' }}>
              · {summary.adguardUrl}
            </span>
          )}
          {summary?.lastUpdated && (
            <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
              · 更新于 {new Date(summary.lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--c-text-secondary)' }}
            title="配置 AdGuardHome 连接"
          >
            <Gear size={16} />
          </button>
          <button
            onClick={handleExport}
            disabled={!domains.length}
            className="glass-card inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: 'var(--c-text)' }}
          >
            <FileCsv size={14} />
            导出 CSV
          </button>
          <button
            onClick={handleCopy}
            disabled={!domains.length && !summary?.adguardUrl}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: copyOk ? 'var(--c-success)' : 'var(--c-accent-soft)',
              color: copyOk ? '#fff' : 'var(--c-accent)',
              border: 'none',
            }}
          >
            <ChatCircleText size={14} />
            {copyOk ? '已复制!' : '向 LLM 提问'}
          </button>
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs select-none"
            style={{ color: 'var(--c-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            自动刷新
          </label>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:cursor-wait disabled:opacity-60"
            style={{ background: 'var(--c-accent-gradient)', border: 'none' }}
          >
            <ArrowClockwise size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? '刷新中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>分析概览</span>
          {summary?.timeRange?.start && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
              style={{ background: 'oklch(0.55 0.18 150 / 0.1)', color: 'var(--c-success)' }}>
              {(() => {
                const h = parseInt(localStorage.getItem('adgh_time_hours') ?? '24', 10)
                if (h >= 720) return '最近 30 天'
                if (h >= 168) return '最近 7 天'
                return '最近 24h'
              })()}
            </span>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton />
          </div>
        ) : (
          <KpiCards
            totalQueries={totalCount}
            cacheHitRate={overallCacheRate}
            uncached={overallUncached}
            all={overallAll}
          />
        )}
      </div>

      {/* Stats Panel (实时统计数据来自 AdGuardHome) */}
      {!loading && (
        <div className="mb-6">
          <StatsPanel onRefreshNeeded={refresh} />
        </div>
      )}

      {/* Latency Chart */}
      <div className="mb-6">
        {loading ? <ChartSkeleton /> : (
          <LatencyChart domains={domains} mode="uncached" />
        )}
      </div>

      {/* Domain Table */}
      {loading ? <TableSkeleton /> : <DomainTable domains={domains} />}

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onConfigured={() => setTimeout(refresh, 500)}
      />
    </div>
  )
}
