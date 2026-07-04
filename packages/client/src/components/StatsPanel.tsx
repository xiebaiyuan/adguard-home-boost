import { useState, useEffect, lazy, Suspense } from 'react'
import { ClockCounterClockwise, Users, ShieldCheck } from '@phosphor-icons/react'
import type { AdguardStats } from '../lib/types'
import { fmtPreciseMs } from '../lib/format'
import { useI18n } from '../lib/i18n'

// 图表组件懒加载：recharts (~65KB gz) 只在图表实际显示时才下载
const PieChartCard = lazy(() => import('./PieChartCard'))
const TrendChart = lazy(() => import('./TrendChart'))

/** 卡片容器：永久存在于 DOM 中，仅内容淡入。无骨架、无跳动。 */
function Card({ title, icon, children, ready }: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  ready: boolean
}) {
  return (
    <div className="glass-card rounded-xl p-4" style={{ minHeight: '140px' }}>
      <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--c-text-secondary)' }}>
        {icon}{title}
      </h4>
      <div style={{
        opacity: ready ? 1 : 0,
        transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        transform: ready ? 'none' : 'translateY(4px)',
      }}>
        {children}
      </div>
    </div>
  )
}

export function StatsPanel({ onRefreshNeeded, queryTypeDistribution }: {
  onRefreshNeeded: () => void
  queryTypeDistribution?: Array<{ name: string; value: number }>
}) {
  const [stats, setStats] = useState<AdguardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState<string | null>(null)
  const [showCharts, setShowCharts] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/analysis/stats')
      .then(r => r.ok ? r.json() : Promise.reject(String(r.status)))
      .then(data => { if (!cancelled) { setStats(data); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [onRefreshNeeded])

  // 数据就绪后才启用图表渲染（延迟一帧，避免展开交互卡顿）
  useEffect(() => {
    if (!loading && stats) {
      const id = requestAnimationFrame(() => setShowCharts(true))
      return () => cancelAnimationFrame(id)
    }
  }, [loading, stats])

  const ready = !loading && stats !== null
  const blockedRatio = ready ? [
    { name: t('stats.blocked'), value: stats!.totalBlocked },
    { name: t('stats.allowed'), value: stats!.totalQueries },
  ] : []

  return (
    <div className="space-y-6">

      {/* ── KPI 行 ── 永久 4 卡片，数据到了淡入数字 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card title={t('stats.avgProcess')} icon={<ClockCounterClockwise size={14} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums gradient-text" style={{ minHeight: '1.5rem' }}>
            {ready ? fmtPreciseMs(stats!.avgProcessingTime * 1000) : '—'}
          </div>
        </Card>
        <Card title={t('stats.upstreams')} icon={<span className="h-2 w-2 rounded-full" style={{ background: 'var(--c-accent)' }} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums gradient-text" style={{ minHeight: '1.5rem' }}>
            {ready ? stats!.topUpstreams.length : '—'}
          </div>
        </Card>
        <Card title={t('stats.blocked')} icon={<ShieldCheck size={14} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums" style={{ minHeight: '1.5rem', color: ready ? 'var(--c-danger)' : 'inherit' }}>
            {ready ? <>{stats!.totalBlocked.toLocaleString()}<span className="ml-1 text-sm font-normal" style={{ color: 'var(--c-text-secondary)' }}>({((stats!.totalBlocked / (stats!.totalQueries + stats!.totalBlocked)) * 100).toFixed(1)}%)</span></> : '—'}
          </div>
        </Card>
        <Card title={t('stats.clients')} icon={<Users size={14} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums gradient-text" style={{ minHeight: '1.5rem' }}>
            {ready ? stats!.topClients.length : '—'}
          </div>
        </Card>
      </div>

      {/* ── 图表行 ── 3 列，图表未就绪时 Card 占位，就绪后 PieChartCard 直接渲染（它自带 glass-card） ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={t('stats.blockRate')} ready={showCharts}>
          {showCharts ? (
            <Suspense fallback={<div style={{ minHeight: '7rem' }} />}>
              <PieChartCard data={blockedRatio} />
            </Suspense>
          ) : <div style={{ minHeight: '7rem' }} />}
        </Card>
        <Card title={t('stats.typeDist')} ready={showCharts && !!queryTypeDistribution?.length}>
          {showCharts && queryTypeDistribution?.length ? (
            <Suspense fallback={<div style={{ minHeight: '7rem' }} />}>
              <PieChartCard data={queryTypeDistribution} />
            </Suspense>
          ) : <div style={{ minHeight: '7rem' }} />}
        </Card>
        <Card title={t('stats.clientRank')} ready={showCharts && !!stats?.topClients.length}>
          {showCharts && stats?.topClients.length ? (
            <Suspense fallback={<div style={{ minHeight: '7rem' }} />}>
              <PieChartCard data={stats!.topClients.map(c => ({ name: c.name || c.ip, value: c.count }))} />
            </Suspense>
          ) : <div style={{ minHeight: '7rem' }} />}
        </Card>
      </div>

      {/* ── 表格行 ── 3 列始终存在 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 客户端排行 */}
        <Card title={t('stats.clientRank')} icon={<Users size={14} className="mr-1 inline" />} ready={ready}>
          <div className="space-y-1">
            {ready && stats!.topClients.length > 0 ? stats!.topClients.map((c, i) => (
              <div key={c.ip} className="flex items-center gap-2 text-xs">
                <span className="w-4 shrink-0 text-right tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>{i + 1}</span>
                <span className="font-mono text-[11px]">
                  {c.name ? <>{c.name}<span className="ml-1" style={{ color: 'var(--c-text-secondary)' }}>({c.ip})</span></> : c.ip}
                </span>
                <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>{c.count.toLocaleString()}</span>
              </div>
            )) : <div className="h-4" />}
          </div>
        </Card>

        {/* 屏蔽域名排行 */}
        <Card title={t('stats.blockDomainRank')} icon={<ShieldCheck size={14} className="mr-1 inline" />} ready={ready}>
          {ready && stats!.topBlockedDomains.length > 0 ? (
            <div className="space-y-1">
              {stats!.topBlockedDomains.slice(0, 10).map((d, i) => (
                <div key={d.domain} className="flex items-center gap-2 text-xs">
                  <span className="w-4 shrink-0 text-right tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>{i + 1}</span>
                  <span className="truncate">{d.domain}</span>
                  <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-danger)' }}>{d.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{ready ? t('stats.noBlockData') : ''}</span>}
        </Card>

        {/* 上游服务响应 */}
        <Card title={t('stats.upstreamResp')} icon={<span className="h-2 w-2 rounded-full mr-1 inline-block" style={{ background: 'var(--c-accent)' }} />} ready={ready}>
          <div className="space-y-1">
            {ready && stats!.topUpstreams.length > 0 ? stats!.topUpstreams.map(u => (
              <div key={u.upstream} className="flex items-center gap-2 text-xs">
                <span className="max-w-[120px] truncate font-mono text-[11px]">{u.upstream}</span>
                <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>
                  {u.count.toLocaleString()} {t('domain.times')} · {fmtPreciseMs(u.avgTime * 1000)}
                </span>
              </div>
            )) : <div className="h-4" />}
          </div>
        </Card>
      </div>

      {/* ── 趋势图 ── 始终占位，防止挤动下方域名排行 ── */}
      {showCharts && stats?.history && stats.history.length > 0 ? (
        <Suspense fallback={<div className="glass-card rounded-xl p-4 sm:p-6" style={{ minHeight: '240px' }} />}>
          <TrendChart history={stats.history} timeUnit={stats.timeSpan!.unit} />
        </Suspense>
      ) : (
        <div className="glass-card rounded-xl p-4 sm:p-6" style={{ minHeight: '240px' }}>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-border)' }} />
            <div className="h-4 w-20 rounded" style={{ background: 'var(--c-border)' }} />
          </div>
        </div>
      )}
    </div>
  )
}
