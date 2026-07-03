import { FileCsv, ArrowClockwise, Gear, ChatCircleText, ShieldCheck, Prohibit, Trash, Sliders } from '@phosphor-icons/react'
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useAdguard } from '../hooks/useAdguard'
import { KpiCards } from './KpiCards'
import { DomainTable } from './DomainTable'
import { StatsPanel } from './StatsPanel'
import { CollapseSection } from './CollapseSection'
import { SettingsDialog } from './SettingsDialog'
import { ManagementDialog } from './ManagementDialog'
import { exportCsv } from '../lib/csv'
import { buildPrompt, copyToClipboard } from '../lib/prompt'
import { TIME_OPTIONS } from '../lib/format'

// 懒加载：recharts 链路只在需要图表时下载
const LatencyChart = lazy(() => import('./LatencyChart'))

function getPanelVisible(key: string, def: boolean): boolean {
  const stored = localStorage.getItem(key)
  return stored !== null ? stored === 'true' : def
}

export function Dashboard() {
  const { loading, error, summary, domains, refresh, refreshing } = useAnalysis()
  const adguard = useAdguard()
  const [showSettings, setShowSettings] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const autoRef = useRef(autoRefresh)
  autoRef.current = autoRefresh

  // Panel visibility from localStorage
  const [showStatsPanel, setShowStatsPanel] = useState(() => getPanelVisible('panel_stats', true))
  const [showManagement, setShowManagement] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const timePickerRef = useRef<HTMLDivElement | null>(null)

  const currentTimeHours = parseInt(localStorage.getItem('adgh_time_hours') ?? '24', 10)

  // 整体聚合统计 — useMemo 避免每次渲染重新计算
  const aggregateStats = useMemo(() => {
    const totalCount = domains.reduce((s, d) => s + d.totalCount, 0)
    const totalCached = domains.reduce((s, d) => s + d.cachedCount, 0)
    const overallCacheRate = totalCount > 0 ? totalCached / totalCount : 0

    const allUncached = domains.map(d => d.uncached)
    const allAll = domains.map(d => d.all)

    const computeOverall = (latencies: typeof allUncached) => {
      if (latencies.length === 0) return null
      const totalC = latencies.reduce((s, l) => s + l.count, 0)
      const slowC = latencies.reduce((s, l) => s + l.slowRate * l.count, 0)
      const severeC = latencies.reduce((s, l) => s + l.severeRate * l.count, 0)
      const p50s = [...latencies].sort((a, b) => a.p50 - b.p50)
      const p95s = [...latencies].sort((a, b) => a.p95 - b.p95)
      return {
        count: totalC,
        min: Math.min(...latencies.map(l => l.min)),
        max: Math.max(...latencies.map(l => l.max)),
        avg: latencies.reduce((s, l) => s + l.avg * l.count, 0) / totalC,
        p20: 0, p50: p50s[Math.floor(p50s.length / 2)]?.p50 ?? 0,
        p60: 0, p70: 0,
        p80: 0, p95: p95s[Math.floor(p95s.length * 0.95)]?.p95 ?? 0,
        p99: 0,
        slowRate: totalC > 0 ? slowC / totalC : 0,
        severeRate: totalC > 0 ? severeC / totalC : 0,
      }
    }

    return {
      totalCount,
      totalCached,
      overallCacheRate,
      overallUncached: computeOverall(allUncached),
      overallAll: computeOverall(allAll),
    }
  }, [domains])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (timePickerRef.current && !timePickerRef.current.contains(e.target as Node)) {
        setShowTimePicker(false)
      }
    }
    if (showTimePicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTimePicker])

  const changeTimeRange = async (hours: number) => {
    setShowTimePicker(false)
    localStorage.setItem('adgh_time_hours', String(hours))

    const url = localStorage.getItem('adgh_url')
    const user = localStorage.getItem('adgh_user')
    const pass = localStorage.getItem('adgh_pass')
    if (!url || !user || !pass) return

    await fetch('/api/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        adguardConfig: {
          baseUrl: url.replace(/\/$/, ''),
          username: user,
          password: pass,
          rejectUnauthorized: false,
          timeRangeHours: hours,
        },
      }),
    }).catch(() => {})
    refresh()
  }

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

  // Aggregate query type distribution across all domains
  const queryTypeDistribution = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const d of domains) {
      for (const [t, c] of Object.entries(d.queryTypes)) {
        acc[t] = (acc[t] ?? 0) + c
      }
    }
    return Object.entries(acc)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }))
  }, [domains])

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
          {/* Current profile indicator */}
          {summary?.adguardUrl && (
            <span className="hidden text-xs sm:inline" style={{ color: 'var(--c-text-secondary)' }}>
              {localStorage.getItem('adgh_profile_name') || summary.adguardUrl.replace(/^https?:\/\//, '').split('/')[0]}
            </span>
          )}
          {/* Panel visibility toggles */}
          <label
            className="hidden cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider sm:inline-flex select-none transition-colors"
            style={{
              color: showStatsPanel ? 'var(--c-accent)' : 'var(--c-text-secondary)',
              background: showStatsPanel ? 'var(--c-accent-soft)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={showStatsPanel}
              onChange={e => { setShowStatsPanel(e.target.checked); localStorage.setItem('panel_stats', String(e.target.checked)) }}
              className="hidden"
            />
            统计
          </label>
          {/* Protection toggle — 始终占位（min-width 防止 status 就绪前按钮凭空出现） */}
          <div className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 transition-colors" style={{ color: adguard.status?.protectionEnabled ? 'var(--c-success)' : 'var(--c-text-secondary)', minWidth: '70px', visibility: adguard.status ? 'visible' : 'hidden' }}>
            {adguard.status ? (() => {
              const prot = adguard.status.protectionEnabled
              return (
                <button
                  onClick={() => adguard.toggleProtection(!prot)}
                  disabled={adguard.saving === 'protection'}
                  className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium uppercase tracking-wider disabled:opacity-60"
                  style={{
                    background: 'transparent',
                    color: prot ? 'var(--c-success)' : 'var(--c-danger)',
                    border: 'none',
                  }}
                >
                  {prot ? <ShieldCheck size={12} /> : <Prohibit size={12} />}
                  {prot ? '保护中' : '已暂停'}
                </button>
              )
            })() : <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>保护...</span>}
          </div>
          {/* Clear cache */}
          <button
            onClick={() => adguard.clearCache()}
            disabled={adguard.saving === 'cache'}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors disabled:opacity-40"
            style={{ color: 'var(--c-text-secondary)' }}
            title="清除 DNS 缓存"
          >
            <Trash size={14} />
          </button>
          {/* Open management */}
          <button
            onClick={() => setShowManagement(true)}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--c-text-secondary)' }}
            title="AdGuardHome 管理（规则/安全/维护）"
          >
            <Sliders size={14} />
          </button>
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
            <div className="relative" ref={timePickerRef}>
              <button
                onClick={() => setShowTimePicker(!showTimePicker)}
                className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors hover:opacity-80"
                style={{ background: 'oklch(0.55 0.18 150 / 0.1)', color: 'var(--c-success)' }}
              >
                {(() => {
                  if (currentTimeHours >= 720) return '最近 30 天'
                  if (currentTimeHours >= 168) return '最近 7 天'
                  return '最近 24h'
                })()}
              </button>
              {showTimePicker && (
                <div
                  className="glass-card absolute left-0 top-full z-20 mt-1 min-w-[120px] overflow-hidden rounded-lg text-xs shadow-lg"
                  style={{ border: '1px solid var(--c-border)' }}
                >
                  {TIME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => changeTimeRange(opt.value)}
                      className={`block w-full cursor-pointer px-3 py-2 text-left transition-colors hover:opacity-80 ${
                        currentTimeHours === opt.value ? 'font-medium' : ''
                      }`}
                      style={{
                        color: currentTimeHours === opt.value ? 'var(--c-accent)' : 'var(--c-text)',
                        background: currentTimeHours === opt.value ? 'var(--c-accent-soft)' : 'transparent',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="fade-in-content">
          <KpiCards
            totalQueries={loading ? 0 : aggregateStats.totalCount}
            cacheHitRate={loading ? 0 : aggregateStats.overallCacheRate}
            uncached={loading ? null : aggregateStats.overallUncached}
            all={loading ? null : aggregateStats.overallAll}
          />
        </div>
      </div>

      {/* Stats Panel (实时统计数据来自 AdGuardHome) */}
      {showStatsPanel && (
        <CollapseSection title="实时统计" storageKey="collapse_stats" defaultOpen badge={
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
            AdGuardHome
          </span>
        }>
          <StatsPanel onRefreshNeeded={refresh} queryTypeDistribution={queryTypeDistribution} />
        </CollapseSection>
      )}

      {/* Latency Chart */}
      <CollapseSection title="域名延时分布" storageKey="collapse_latency">
        <div className="mb-6 fade-in-content">
          <Suspense fallback={<div className="glass-card rounded-xl p-4 sm:p-6">
            <div className="mb-4 h-4 w-32 rounded" style={{ background: 'var(--c-border)' }} />
            <div className="h-48 sm:h-52" style={{ background: 'var(--c-accent-soft)' }} />
          </div>}>
            <LatencyChart domains={domains} mode="uncached" />
          </Suspense>
        </div>
      </CollapseSection>

      {/* Domain Table */}
      <CollapseSection title="域名延时排行" storageKey="collapse_domains">
        <div className="fade-in-content">
          <DomainTable domains={domains} />
        </div>
      </CollapseSection>

      <ManagementDialog
        open={showManagement}
        onClose={() => setShowManagement(false)}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onConfigured={() => setTimeout(refresh, 500)}
      />
    </div>
  )
}
