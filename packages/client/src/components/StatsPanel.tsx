import { useState, useEffect, lazy, Suspense } from 'react'
import { ClockCounterClockwise, Users, ShieldCheck } from '@phosphor-icons/react'
import type { AdguardStats } from '../lib/types'
import { fmtPreciseMs } from '../lib/format'

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
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
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
    { name: '已屏蔽', value: stats!.totalBlocked },
    { name: '已放行', value: stats!.totalQueries },
  ] : []

  return (
    <div className="space-y-6">

      {/* ── KPI 行 ── 永久 4 卡片，数据到了淡入数字 ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card title="平均处理" icon={<ClockCounterClockwise size={14} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums gradient-text" style={{ minHeight: '1.5rem' }}>
            {ready ? fmtPreciseMs(stats!.avgProcessingTime * 1000) : '—'}
          </div>
        </Card>
        <Card title="上游服务数" icon={<span className="h-2 w-2 rounded-full" style={{ background: 'var(--c-accent)' }} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums gradient-text" style={{ minHeight: '1.5rem' }}>
            {ready ? stats!.topUpstreams.length : '—'}
          </div>
        </Card>
        <Card title="已屏蔽" icon={<ShieldCheck size={14} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums" style={{ minHeight: '1.5rem', color: ready ? 'var(--c-danger)' : 'inherit' }}>
            {ready ? <>{stats!.totalBlocked.toLocaleString()}<span className="ml-1 text-sm font-normal" style={{ color: 'var(--c-text-secondary)' }}>({((stats!.totalBlocked / (stats!.totalQueries + stats!.totalBlocked)) * 100).toFixed(1)}%)</span></> : '—'}
          </div>
        </Card>
        <Card title="客户端数" icon={<Users size={14} />} ready={ready}>
          <div className="text-xl font-semibold tabular-nums gradient-text" style={{ minHeight: '1.5rem' }}>
            {ready ? stats!.topClients.length : '—'}
          </div>
        </Card>
      </div>

      {/* ── 图表行 ── 3 列始终存在，图表内容 showCharts 后才渲染 — Card 占位与 PieChartCard 同高同结构 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {showCharts ? (
          <Suspense fallback={<Card title="屏蔽比例" ready={false}><div style={{ minHeight: '8rem' }} /></Card>}>
            <PieChartCard title="屏蔽比例" data={blockedRatio} />
          </Suspense>
        ) : (
          <Card title="屏蔽比例" ready={false}><div style={{ minHeight: '8rem' }} /></Card>
        )}
        {showCharts && queryTypeDistribution?.length ? (
          <Suspense fallback={<Card title="查询类型分布" ready={false}><div style={{ minHeight: '8rem' }} /></Card>}>
            <PieChartCard title="查询类型分布" data={queryTypeDistribution} />
          </Suspense>
        ) : (
          <Card title="查询类型分布" ready={false}><div style={{ minHeight: '8rem' }} /></Card>
        )}
        {ready && stats!.topClients.length > 0 ? (showCharts ? (
          <Suspense fallback={<Card title="客户端排行 (Top 6)" ready={false}><div style={{ minHeight: '8rem' }} /></Card>}>
            <PieChartCard title="客户端排行 (Top 6)" data={stats!.topClients.map(c => ({ name: c.name || c.ip, value: c.count }))} />
          </Suspense>
        ) : (
          <Card title="客户端排行 (Top 6)" ready={false}><div style={{ minHeight: '8rem' }} /></Card>
        )) : (
          <Card title="客户端排行 (Top 6)" ready={false}><div style={{ minHeight: '8rem' }} /></Card>
        )}
      </div>

      {/* ── 表格行 ── 3 列始终存在 ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 客户端排行 */}
        <Card title="客户端排行" icon={<Users size={14} className="mr-1 inline" />} ready={ready}>
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
        <Card title="屏蔽域名排行" icon={<ShieldCheck size={14} className="mr-1 inline" />} ready={ready}>
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
          ) : <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{ready ? '暂无屏蔽记录' : ''}</span>}
        </Card>

        {/* 上游服务响应 */}
        <Card title="上游服务响应" icon={<span className="h-2 w-2 rounded-full mr-1 inline-block" style={{ background: 'var(--c-accent)' }} />} ready={ready}>
          <div className="space-y-1">
            {ready && stats!.topUpstreams.length > 0 ? stats!.topUpstreams.map(u => (
              <div key={u.upstream} className="flex items-center gap-2 text-xs">
                <span className="max-w-[120px] truncate font-mono text-[11px]">{u.upstream}</span>
                <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>
                  {u.count.toLocaleString()} 次 · {fmtPreciseMs(u.avgTime * 1000)}
                </span>
              </div>
            )) : <div className="h-4" />}
          </div>
        </Card>
      </div>

      {/* ── 趋势图 ── */}
      {showCharts && stats?.history && stats.history.length > 0 && (
        <Suspense fallback={null}>
          <TrendChart history={stats.history} timeUnit={stats.timeSpan!.unit} />
        </Suspense>
      )}
    </div>
  )
}
