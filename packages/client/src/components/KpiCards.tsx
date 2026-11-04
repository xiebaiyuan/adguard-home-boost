import type { LatencyStats } from 'shared'
import { useI18n } from '../lib/i18n'

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  color?: string
  gradient?: string
}

function KpiCard({ label, value, sub, color, gradient = '' }: KpiCardProps) {
  return (
    <div className={`glass-card rounded-xl p-4 ${gradient}`}>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: 'var(--c-text-secondary)' }}>
        {label}
      </div>
      <div style={{
        opacity: value !== '--' ? 1 : 0,
        transition: 'opacity 180ms ease-out',
      }}>
        <div className="text-2xl font-semibold tabular-nums tracking-tight" style={{ color: color ?? 'var(--c-text)' }}>
          {value}
        </div>
        {/* sub 行始终占用高度，防止数据就绪后内容被撑开 */}
        <div className="mt-0.5 min-h-[1em]">
          {sub && (
            <span className="text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{sub}</span>
          )}
        </div>
      </div>
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
  const { t } = useI18n()
  const hasData = totalQueries > 0
  const fmt = (n: number) => n.toLocaleString()
  const fmtMs = (n: number) => `${n.toFixed(0)}ms`
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label={t('kpi.totalQueries')}
        value={hasData ? fmt(totalQueries) : t('kpi.dash')}
        sub={all && all.slowRate > 0 ? `${t('kpi.slow')} ${fmtPct(all.slowRate)}` : undefined}
        color="var(--c-accent)"
        gradient="kpi-gradient-1"
      />
      <KpiCard
        label={t('kpi.cacheHitRate')}
        value={hasData ? fmtPct(cacheHitRate) : t('kpi.dash')}
        color={hasData ? (cacheHitRate > 0.8 ? 'var(--c-success)' : cacheHitRate > 0.5 ? 'var(--c-warning)' : 'var(--c-danger)') : undefined}
        gradient="kpi-gradient-2"
      />
      <KpiCard
        label={t('kpi.p50')}
        value={all ? fmtMs(all.p50) : t('kpi.dash')}
        sub={uncached ? `${t('kpi.uncached')} ${fmtMs(uncached.p50)}` : undefined}
        gradient="kpi-gradient-3"
      />
      <KpiCard
        label={t('kpi.p95')}
        value={all ? fmtMs(all.p95) : t('kpi.dash')}
        sub={uncached ? `${t('kpi.uncached')} ${fmtMs(uncached.p95)}` : undefined}
        color={all && all.p95 > 1000 ? 'var(--c-danger)' : all && all.p95 > 500 ? 'var(--c-warning)' : undefined}
        gradient="kpi-gradient-4"
      />
    </div>
  )
}
