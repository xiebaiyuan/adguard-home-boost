import { FileCsv, ArrowClockwise, Gear } from '@phosphor-icons/react'
import { useState } from 'react'
import { useAnalysis } from '../hooks/useAnalysis'
import { KpiCards } from './KpiCards'
import { LatencyChart } from './LatencyChart'
import { DomainTable } from './DomainTable'
import { KpiSkeleton, ChartSkeleton, TableSkeleton } from './Skeleton'
import { SettingsDialog } from './SettingsDialog'
import { exportCsv } from '../lib/csv'

export function Dashboard() {
  const { loading, error, summary, domains, refresh, refreshing } = useAnalysis()
  const [showSettings, setShowSettings] = useState(false)

  const totalCount = domains.reduce((s, d) => s + d.totalCount, 0)
  const totalCached = domains.reduce((s, d) => s + d.cachedCount, 0)
  const overallCacheRate = totalCount > 0 ? totalCached / totalCount : 0

  const allUncached = domains.map(d => d.uncached)
  const allAll = domains.map(d => d.all)
  const overallUncached = allUncached.length > 0 ? {
    ...allUncached[0],
    count: allUncached.reduce((s, l) => s + l.count, 0),
    min: Math.min(...allUncached.map(l => l.min)),
    max: Math.max(...allUncached.map(l => l.max)),
    avg: allUncached.reduce((s, l) => s + l.avg * l.count, 0) / allUncached.reduce((s, l) => s + l.count, 0),
    p50: [...allUncached].sort((a, b) => a.p50 - b.p50)[Math.floor(allUncached.length / 2)]?.p50 ?? 0,
    p95: [...allUncached].sort((a, b) => a.p95 - b.p95)[Math.floor(allUncached.length * 0.95)]?.p95 ?? 0,
  } : null

  const overallAll = allAll.length > 0 ? {
    ...allAll[0],
    count: allAll.reduce((s, l) => s + l.count, 0),
    min: Math.min(...allAll.map(l => l.min)),
    max: Math.max(...allAll.map(l => l.max)),
    avg: allAll.reduce((s, l) => s + l.avg * l.count, 0) / allAll.reduce((s, l) => s + l.count, 0),
    p50: [...allAll].sort((a, b) => a.p50 - b.p50)[Math.floor(allAll.length / 2)]?.p50 ?? 0,
    p95: [...allAll].sort((a, b) => a.p95 - b.p95)[Math.floor(allAll.length * 0.95)]?.p95 ?? 0,
  } : null

  const handleExport = () => {
    if (!domains.length) return
    exportCsv(domains)
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
