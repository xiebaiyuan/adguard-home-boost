import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis } from 'recharts'
import { ClockCounterClockwise, Users, ShieldCheck } from '@phosphor-icons/react'
import type { AdguardStats } from '../lib/types'
import { fmtPreciseMs } from '../lib/format'

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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/analysis/stats')
      .then(r => r.ok ? r.json() : Promise.reject(String(r.status)))
      .then(data => { if (!cancelled) { setStats(data); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [onRefreshNeeded])

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="glass-card animate-pulse rounded-xl p-4">
            <div className="mb-2 h-3 w-20 rounded" style={{ background: 'var(--c-border)' }} />
            <div className="h-6 w-16 rounded" style={{ background: 'var(--c-border)' }} />
          </div>
        ))}
      </div>
    )
  }

  if (error || !stats) return null

  const blockedRatio = [
    { name: '已屏蔽', value: stats.totalBlocked },
    { name: '已放行', value: stats.totalQueries },
  ]

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>实时统计</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
          {stats.timeSpan.count} {stats.timeSpan.unit === 'days' ? '天' : stats.timeSpan.unit}
        </span>
      </div>

      {/* KPI row */}
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

      {/* Charts row */}
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
            data={stats.topClients.map(c => ({ name: c.ip, value: c.count }))}
          />
        )}
      </div>

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
                <span className="font-mono">{c.ip}</span>
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
      {stats.history && stats.history.length > 0 && (
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-accent)' }} />
            <h3 className="text-sm font-medium">查询趋势</h3>
            <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
              过去 {stats.history.length} {stats.timeSpan.unit === 'days' ? '天' : stats.timeSpan.unit}
            </span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.history.map((h, i) => ({ ...h, index: i }))}>
                <defs>
                  <linearGradient id="queriesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-danger)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--c-danger)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="index" hide />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--c-glass)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(i: any) => `第 ${i + 1} 天`}
                />
                <Area type="monotone" dataKey="queries" stroke="var(--c-accent)" strokeWidth={2} fill="url(#queriesGrad)" name="查询数" />
                <Area type="monotone" dataKey="blocked" stroke="var(--c-danger)" strokeWidth={1.5} fill="url(#blockedGrad)" name="已屏蔽" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
