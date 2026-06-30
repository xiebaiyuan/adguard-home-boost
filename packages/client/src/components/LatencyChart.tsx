import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { DomainStats } from '../lib/types'

interface Bin {
  range: string
  count: number
}

// Use a fixed histogram assumption based on overall P50/P95 spread
function computeHistogram(domains: DomainStats[]): Bin[] {
  if (!domains.length) return []
  const allLatencies = domains.flatMap(d => [d.uncached.p50, d.uncached.p95, d.uncached.max])
  const maxLat = Math.max(...allLatencies, 1)
  const thresholds = [10, 50, 200, 500, 1000, maxLat + 1]
  const labels = ['<10ms', '10-50', '50-200', '200-500', '500-1s', '>1s']

  // Approximate: distribute domains into bins based on their P95
  return labels.map((range, i) => ({
    range,
    count: domains.filter(d => {
      const p95 = d.uncached.p95
      return p95 >= (thresholds[i - 1] ?? 0) && p95 < thresholds[i]
    }).length,
  }))
}

const GRADIENT_COLORS = [
  'oklch(0.55 0.22 260 / 0.6)',
  'oklch(0.55 0.22 260 / 0.7)',
  'oklch(0.55 0.22 260 / 0.8)',
  'oklch(0.68 0.16 75 / 0.8)',
  'oklch(0.58 0.22 27 / 0.7)',
  'oklch(0.58 0.22 27 / 0.85)',
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium" style={{ color: 'var(--c-text)' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString()} 个域名
        </div>
      ))}
    </div>
  )
}

interface LatencyChartProps {
  domains: DomainStats[]
  mode: 'all' | 'uncached'
}

export function LatencyChart({ domains }: LatencyChartProps) {
  const data = computeHistogram(domains)

  if (!domains.length) {
    return (
      <div
        className="glass-card flex items-center justify-center rounded-xl py-12"
      >
        <span className="text-sm" style={{ color: 'var(--c-text-secondary)' }}>暂无数据</span>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-accent)' }} />
        <h3 className="text-sm font-medium">域名延时分布</h3>
        <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
          按 P95 延时区间
        </span>
      </div>
      <div className="h-48 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.85} />
                <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0.45} />
              </linearGradient>
            </defs>
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
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
              {data.map((_, index) => (
                <Cell key={index} fill={GRADIENT_COLORS[index % GRADIENT_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
