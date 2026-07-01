import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ClockCounterClockwise, Users, ShieldCheck } from '@phosphor-icons/react'
import type { AdguardStats } from '../lib/types'
import { fmtPreciseMs } from '../lib/format'
import { TrendChart } from './TrendChart'

const COLORS = [
  'oklch(0.55 0.22 260 / 0.8)',
  'oklch(0.68 0.16 75 / 0.8)',
  'oklch(0.58 0.22 27 / 0.8)',
  'oklch(0.55 0.18 150 / 0.8)',
  'oklch(0.55 0.22 260 / 0.5)',
  'oklch(0.68 0.16 75 / 0.5)',
]

function PieChartCard({ title, data, suffix }: {
  title: string
  data: Array<{ name: string; value: number }>
  suffix?: string
}) {
  if (data.length === 0) return null

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="glass-card rounded-xl p-4">
      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
        {title}
      </h4>
      <div className="flex items-center gap-4">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.slice(0, 6)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={42}
                paddingAngle={2}
              >
                {data.slice(0, 6).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--c-glass)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(val: any) => {
                  const n = typeof val === 'number' ? val : 0
                  return [`${((n / total) * 100).toFixed(1)}%`, title]
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {data.slice(0, 6).map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="truncate" style={{ color: 'var(--c-text)' }}>{d.name}</span>
              <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>
                {((d.value / total) * 100).toFixed(1)}%
                {suffix ? ` · ${d.value}${suffix}` : ''}
              </span>
            </div>
          ))}
        </div>
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
  const [error, setError] = useState<string | null>(null)
  // 延迟渲染图表组件，避免展开时主线程阻塞卡顿
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

  if (loading) return null

  if (error || !stats) return null

  const blockedRatio = [
    { name: '已屏蔽', value: stats.totalBlocked },
    { name: '已放行', value: stats.totalQueries },
  ]

  return (
    <div className="space-y-6">
      {/* KPI 行 — 立即渲染（轻量） */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-card rounded-xl p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <ClockCounterClockwise size={14} />
            平均处理
          </div>
          <div className="text-xl font-semibold tabular-nums gradient-text">
            {fmtPreciseMs(stats.avgProcessingTime * 1000)} {/* API returns seconds */}
          </div>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--c-accent)' }} />
            上游服务数
          </div>
          <div className="text-xl font-semibold tabular-nums gradient-text">
            {stats.topUpstreams.length}
          </div>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <ShieldCheck size={14} />
            已屏蔽
          </div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: 'var(--c-danger)' }}>
            {stats.totalBlocked.toLocaleString()}
            <span className="ml-1 text-sm font-normal" style={{ color: 'var(--c-text-secondary)' }}>
              ({((stats.totalBlocked / (stats.totalQueries + stats.totalBlocked)) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <Users size={14} />
            客户端数
          </div>
          <div className="text-xl font-semibold tabular-nums gradient-text">
            {stats.topClients.length}
          </div>
        </div>
      </div>

      {/* 图表行 — 延迟渲染（Recharts 组件较重） */}
      {showCharts && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PieChartCard
            title="屏蔽比例"
            data={blockedRatio}
          />
          {queryTypeDistribution && queryTypeDistribution.length > 0 && (
            <PieChartCard
              title="查询类型分布"
              data={queryTypeDistribution}
            />
          )}
          {stats.topClients.length > 0 && (
            <PieChartCard
              title="客户端排行 (Top 6)"
              data={stats.topClients.map(c => ({ name: c.name || c.ip, value: c.count }))}
            />
          )}
        </div>
      )}

      {/* Tables row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top clients */}
        <div className="glass-card rounded-xl p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <Users size={14} className="mr-1 inline" />
            客户端排行
          </h4>
          <div className="space-y-1">
            {stats.topClients.map((c, i) => (
              <div key={c.ip} className="flex items-center gap-2 text-xs">
                <span className="w-4 shrink-0 text-right tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>{i + 1}</span>
                <span className="font-mono text-[11px]">
                  {c.name ? <>{c.name}<span className="ml-1" style={{ color: 'var(--c-text-secondary)' }}>({c.ip})</span></> : c.ip}
                </span>
                <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>{c.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top blocked domains */}
        <div className="glass-card rounded-xl p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <ShieldCheck size={14} className="mr-1 inline" />
            屏蔽域名排行
          </h4>
          {stats.topBlockedDomains.length > 0 ? (
            <div className="space-y-1">
              {stats.topBlockedDomains.slice(0, 10).map((d, i) => (
                <div key={d.domain} className="flex items-center gap-2 text-xs">
                  <span className="w-4 shrink-0 text-right tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>{i + 1}</span>
                  <span className="truncate">{d.domain}</span>
                  <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-danger)' }}>{d.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>暂无屏蔽记录</span>
          )}
        </div>

        {/* Upstream response times */}
        <div className="glass-card rounded-xl p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>
            <span className="h-2 w-2 rounded-full mr-1 inline-block" style={{ background: 'var(--c-accent)' }} />
            上游服务响应
          </h4>
          <div className="space-y-1">
            {stats.topUpstreams.map(u => (
              <div key={u.upstream} className="flex items-center gap-2 text-xs">
                <span className="max-w-[120px] truncate font-mono text-[11px]">{u.upstream}</span>
                <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>
                  {u.count.toLocaleString()} 次 · {fmtPreciseMs(u.avgTime * 1000)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* History trend chart */}
      {showCharts && stats.history && stats.history.length > 0 && (
        <TrendChart history={stats.history} timeUnit={stats.timeSpan.unit} />
      )}
    </div>
  )
}
