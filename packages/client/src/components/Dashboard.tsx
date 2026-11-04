import { FileCsv, ArrowClockwise, Gear, ShieldCheck, Prohibit, Trash, Sliders } from '@phosphor-icons/react'
import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { useAnalysis } from '../hooks/useAnalysis'
import { useAdguard } from '../hooks/useAdguard'
import { useI18n } from '../lib/i18n'
import { KpiCards } from './KpiCards'
import { DomainTable } from './DomainTable'
import { StatsPanel } from './StatsPanel'
import { CollapseSection } from './CollapseSection'
import { SettingsDialog } from './SettingsDialog'
import { ManagementDialog } from './ManagementDialog'
import { exportCsv } from '../lib/csv'
import { TIME_OPTIONS } from '../lib/format'

// 懒加载：recharts 链路只在需要图表时下载
const LatencyChart = lazy(() => import('./LatencyChart'))

function getPanelVisible(key: string, def: boolean): boolean {
  const stored = localStorage.getItem(key)
  return stored !== null ? stored === 'true' : def
}

export function Dashboard() {
  const { t } = useI18n()
  const { loading, error, data, refresh, refreshing } = useAnalysis()
  const adguard = useAdguard()
  const [showSettings, setShowSettings] = useState(false)
  const timePickerRef = useRef<HTMLDivElement | null>(null)

  // Panel visibility from localStorage
  const [showStatsPanel, setShowStatsPanel] = useState(() => getPanelVisible('panel_stats', true))
  const [showManagement, setShowManagement] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const currentTimeHours = parseInt(localStorage.getItem('adgh_time_hours') ?? '24', 10)

  const aggregate = data?.aggregate
  const domains = data?.domains ?? []
  const queryTypeDistribution = data?.queryTypeDistribution

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

  const handleExport = () => {
    if (!domains.length) return
    exportCsv(domains)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      {/* Error banner：整页错误优先，其次动作级错误（#14） */}
      {(error ?? adguard.actionError) && (
        <div
          role="alert"
          className="mb-5 rounded-lg border px-4 py-3 text-sm fade-in"
          style={{ borderColor: 'var(--c-danger)', background: 'oklch(0.58 0.22 27 / 0.08)', color: 'var(--c-danger)' }}
        >
          {error ?? adguard.actionError}
        </div>
      )}

      {/* Toolbar */}
      <div className="glass-card mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 rounded-full" style={{ background: data?.ready ? 'var(--c-success)' : 'var(--c-text-secondary)' }} />
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text)' }}>
            {data?.ready ? t('status.ready') : t('status.waiting')}
          </span>
          {data?.adguardUrl && (
            <span className="hidden text-xs sm:inline" style={{ color: 'var(--c-text-secondary)' }}>
              · {data.adguardUrl}
            </span>
          )}
          {data?.lastUpdated && (
            <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
              · {t('status.updated')} {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Current profile indicator */}
          {data?.adguardUrl && (
            <span className="hidden text-xs sm:inline" style={{ color: 'var(--c-text-secondary)' }}>
              {localStorage.getItem('adgh_profile_name') || data.adguardUrl.replace(/^https?:\/\//, '').split('/')[0]}
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
            {t('btn.statsToggle')}
          </label>
          {/* Protection toggle — 始终占位 */}
          <div className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 transition-colors" style={{ color: adguard.status?.protectionEnabled ? 'var(--c-success)' : 'var(--c-text-secondary)', minWidth: '70px', visibility: adguard.status ? 'visible' : 'hidden' }}>
            {adguard.status ? (() => {
              const prot = adguard.status.protectionEnabled
              return (
                <button
                  onClick={() => adguard.toggleProtection(!prot)}
                  disabled={adguard.saving === 'protection'}
                  className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium uppercase tracking-wider press-effect disabled:opacity-60"
                  style={{
                    background: 'transparent',
                    color: prot ? 'var(--c-success)' : 'var(--c-danger)',
                    border: 'none',
                  }}
                >
                  {prot ? <ShieldCheck size={12} /> : <Prohibit size={12} />}
                  {prot ? t('status.protected') : t('status.paused')}
                </button>
              )
            })() : <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>{t('status.protecting')}</span>}
          </div>
          {/* Clear cache */}
          <button
            onClick={() => adguard.clearCache()}
            disabled={adguard.saving === 'cache'}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 press-effect disabled:opacity-40"
            style={{ color: 'var(--c-text-secondary)' }}
            title={t('btn.clearCache')}
          >
            <Trash size={14} />
          </button>
          {/* Open management */}
          <button
            onClick={() => setShowManagement(true)}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 press-effect"
            style={{ color: 'var(--c-text-secondary)' }}
            title={t('btn.manage')}
          >
            <Sliders size={14} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 press-effect"
            style={{ color: 'var(--c-text-secondary)' }}
            title={t('btn.config')}
          >
            <Gear size={16} />
          </button>
          <button
            onClick={handleExport}
            disabled={!domains.length}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 press-effect disabled:opacity-40"
            style={{ color: 'var(--c-text-secondary)' }}
            title={t('btn.export')}
          >
            <FileCsv size={14} />
          </button>

          <button
            onClick={refresh}
            disabled={refreshing}
            className="glass-card inline-flex cursor-pointer items-center justify-center rounded-lg p-1.5 press-effect disabled:opacity-40"
            style={{ color: 'var(--c-accent)' }}
            title={t('btn.refresh')}
          >
            <ArrowClockwise size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI Cards — 数据来自后端预聚合 */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--c-text)', textWrap: 'balance' }}>{t('section.overview')}</span>
          {data?.timeRange?.start && (
            <div className="relative" ref={timePickerRef}>
              <button
                onClick={() => setShowTimePicker(!showTimePicker)}
                className="cursor-pointer rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider press-effect-soft transition-colors hover:opacity-80"
                style={{ background: 'oklch(0.55 0.18 150 / 0.1)', color: 'var(--c-success)' }}
              >
                {(() => {
                  if (currentTimeHours >= 720) return t('time.recent30d')
                  if (currentTimeHours >= 168) return t('time.recent7d')
                  return t('time.recent24h')
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
                      className={`block w-full cursor-pointer px-3 py-2 text-left transition-colors hover:opacity-80 ${currentTimeHours === opt.value ? 'font-medium' : ''}`}
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
        <div className={data ? 'fade-in-content' : 'shimmer-bg rounded-xl p-4'}>
          <KpiCards
            totalQueries={loading ? 0 : (aggregate?.totalCount ?? 0)}
            cacheHitRate={loading ? 0 : (aggregate?.overallCacheRate ?? 0)}
            uncached={loading ? null : (aggregate?.overallUncached ?? null)}
            all={loading ? null : (aggregate?.overallAll ?? null)}
          />
        </div>
      </div>

      {/* Stats Panel (实时统计数据来自 AdGuardHome) */}
      {showStatsPanel && (
        <CollapseSection title={t('section.stats')} storageKey="collapse_stats" defaultOpen deferUntilOpen badge={
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
            style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
            AdGuardHome
          </span>
        }>
          <StatsPanel queryTypeDistribution={queryTypeDistribution} />
        </CollapseSection>
      )}

      {/* Latency Chart — lazy 加载 */}
      <CollapseSection title={t('section.latency')} storageKey="collapse_latency" deferUntilOpen>
        <div className={domains.length > 0 ? 'mb-6 fade-in-content' : 'mb-6 shimmer-bg rounded-xl p-4'} style={{ minHeight: '200px' }}>
          <Suspense fallback={<div className="glass-card rounded-xl p-4 sm:p-6">
            <div className="mb-4 h-4 w-32 rounded" style={{ background: 'var(--c-border)' }} />
            <div className="h-48 sm:h-52" style={{ background: 'var(--c-accent-soft)' }} />
          </div>}>
            <LatencyChart domains={domains} />
          </Suspense>
        </div>
      </CollapseSection>

      {/* Domain Table */}
      <CollapseSection title={t('section.domainRank')} storageKey="collapse_domains">
        <div className={domains.length > 0 ? 'fade-in-content' : 'shimmer-bg rounded-xl p-4'}>
          <DomainTable domains={domains} />
        </div>
      </CollapseSection>

      <ManagementDialog
        open={showManagement}
        onClose={() => setShowManagement(false)}
        adguard={adguard}
      />

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onConfigured={() => setTimeout(refresh, 500)}
      />
    </div>
  )
}
