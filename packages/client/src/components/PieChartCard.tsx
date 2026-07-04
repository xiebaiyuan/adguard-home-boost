import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useI18n } from '../lib/i18n'

const COLORS = [
  'oklch(0.55 0.22 260 / 0.8)',
  'oklch(0.68 0.16 75 / 0.8)',
  'oklch(0.58 0.22 27 / 0.8)',
  'oklch(0.55 0.18 150 / 0.8)',
  'oklch(0.55 0.22 260 / 0.5)',
  'oklch(0.68 0.16 75 / 0.5)',
]

/** 环图中心总数标签 */
function CenterLabel({ total }: { total: number }) {
  const { t } = useI18n()
  return (
    <>
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 13, fontWeight: 600, fill: 'var(--c-text)', fontVariantNumeric: 'tabular-nums' }}>
        {total.toLocaleString()}
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 9, fill: 'var(--c-text-secondary)' }}>
        {t('pie.total')}
      </text>
    </>
  )
}

export function PieChartCard({ data, suffix }: {
  data: Array<{ name: string; value: number }>
  suffix?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const hasData = data.length > 0

  return (
    <div className="flex items-center gap-4" style={{
      opacity: hasData ? 1 : 0,
      transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      transform: hasData ? 'none' : 'translateY(4px)',
    }}>
      <div className="h-28 w-28 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {hasData && <CenterLabel total={total} />}
            <Pie
              data={hasData ? data.slice(0, 6) : [{ name: '', value: 1 }]}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={24}
              outerRadius={42}
              paddingAngle={2}
              fill={hasData ? undefined : 'var(--c-border)'}
              isAnimationActive={true} animationDuration={400}
            >
              {hasData && data.slice(0, 6).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            {hasData && (
              <Tooltip
                contentStyle={{ background: 'var(--c-glass)', border: '1px solid var(--c-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(val: any) => {
                  const n = typeof val === 'number' ? val : 0
                  return [`${((n / total) * 100).toFixed(1)}%`]
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        {hasData ? data.slice(0, 6).map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="truncate" style={{ color: 'var(--c-text)' }}>{d.name}</span>
            <span className="ml-auto shrink-0 tabular-nums" style={{ color: 'var(--c-text-secondary)' }}>
              {((d.value / total) * 100).toFixed(1)}%
              {suffix ? ` · ${d.value}${suffix}` : ''}
            </span>
          </div>
        )) : <div className="h-24" />}
      </div>
    </div>
  )
}

export default PieChartCard
