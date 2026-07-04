import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DomainStats } from '../lib/types'
import { useI18n } from '../lib/i18n'

interface Bin {
  range: string
  count: number
}

function computeHistogram(domains: DomainStats[]): Bin[] {
  if (!domains.length) return []
  const thresholds = [10, 50, 200, 500, 1000]
  const labels = ['<10ms', '10-50', '50-200', '200-500', '500-1s', '>1s']
  const counts = new Array(labels.length).fill(0)
  for (const d of domains) {
    const p95 = d.uncached.p95
    let bin = thresholds.length
    for (let t = 0; t < thresholds.length; t++) {
      if (p95 < thresholds[t]) { bin = t; break }
    }
    counts[bin]++
  }
  return labels.map((range, i) => ({ range, count: counts[i] }))
}

/** 绿 → 黄 → 红 热力色阶 */
const HEAT_COLORS = [
  'oklch(0.55 0.18 150 / 0.85)',   // <10ms  — green
  'oklch(0.62 0.15 155 / 0.8)',    // 10-50   — teal/green
  'oklch(0.55 0.22 260 / 0.75)',   // 50-200  — blue
  'oklch(0.68 0.16 75 / 0.8)',     // 200-500 — amber
  'oklch(0.65 0.2 50 / 0.8)',      // 500-1s  — orange
  'oklch(0.58 0.22 27 / 0.85)',    // >1s     — red
]

interface LatencyChartProps {
  domains: DomainStats[]
  mode: 'all' | 'uncached'
}

export function LatencyChart({ domains }: LatencyChartProps) {
  const { t } = useI18n()
  const data = useMemo(() => computeHistogram(domains), [domains])
  const total = data.reduce((s, d) => s + d.count, 0)
  // 快于 200ms 的域名（前 3 个 bin）
  const fastCount = data.length >= 3 ? data[0].count + data[1].count + data[2].count : 0
  const fastPct = total > 0 ? Math.round((fastCount / total) * 100) : 0

  if (!domains.length) {
    return (
      <div className="glass-card flex items-center justify-center rounded-xl py-12">
        <span className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>{t('chart.empty')}</span>
      </div>
    )
  }

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const count = payload[0].value as number
    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
    return (
      <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-lg">
        <div className="mb-0.5 font-medium" style={{ color: 'var(--c-text)' }}>{label}</div>
        <div style={{ color: 'var(--c-text-secondary)' }}>
          {count.toLocaleString()} {t('chart.domainUnit')} · {t('chart.ratio')} {pct}%
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-accent)' }} />
        <h3 className="text-sm font-semibold" style={{ textWrap: 'balance' }}>域名延时分布</h3>
        <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
          {total} {t('domain.count')} · {fastPct}% {t('trend.fast')}
        </span>
      </div>
      <div className="h-48 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -16 }}>
            <XAxis
              dataKey="range"
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--c-border)', opacity: 0.3 }} />
            <Bar
              dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}
              isAnimationActive={true} animationDuration={500}
              label={{ position: 'top', fontSize: 10, fill: 'var(--c-text-secondary)', fontWeight: 500 }}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={HEAT_COLORS[index % HEAT_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default LatencyChart
