import type { LatencyStats } from '../lib/types'

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  color?: string
  gradient?: string
}

function KpiCard({ label, value, sub, color, gradient = '' }: KpiCardProps) {
  return (
    <div className={`glass-card rounded-xl p-4 fade-in ${gradient}`}>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--c-text-secondary)' }}>
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums tracking-tight" style={{ color: color ?? 'var(--c-text)' }}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

interface KpiCardsProps {
  totalQueries: number
  cacheHitRate: number
  uncached: LatencyStats | null
  all: LatencyStats | null
}

export function KpiCards({ totalQueries, cacheHitRate, uncached, all }: KpiCardsProps) {
  const fmt = (n: number) => n.toLocaleString()
  const fmtMs = (n: number) => `${n.toFixed(0)}ms`
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="总查询"
        value={fmt(totalQueries)}
        sub={all && all.slowRate > 0 ? `慢查 ${fmtPct(all.slowRate)}` : '无慢查'}
        color="var(--c-accent)"
        gradient="kpi-gradient-1"
      />
      <KpiCard
        label="缓存命中率"
        value={fmtPct(cacheHitRate)}
        color={cacheHitRate > 0.8 ? 'var(--c-success)' : cacheHitRate > 0.5 ? 'var(--c-warning)' : 'var(--c-danger)'}
        gradient="kpi-gradient-2"
      />
      <KpiCard
        label="P50 延时"
        value={all ? fmtMs(all.p50) : '-'}
        sub={uncached ? `uncached ${fmtMs(uncached.p50)}` : undefined}
        gradient="kpi-gradient-3"
      />
      <KpiCard
        label="P95 延时"
        value={all ? fmtMs(all.p95) : '-'}
        sub={uncached ? `uncached ${fmtMs(uncached.p95)}` : undefined}
        color={all && all.p95 > 1000 ? 'var(--c-danger)' : all && all.p95 > 500 ? 'var(--c-warning)' : undefined}
        gradient="kpi-gradient-4"
      />
    </div>
  )
}
