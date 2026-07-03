import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const COLORS = [
  'oklch(0.55 0.22 260 / 0.8)',
  'oklch(0.68 0.16 75 / 0.8)',
  'oklch(0.58 0.22 27 / 0.8)',
  'oklch(0.55 0.18 150 / 0.8)',
  'oklch(0.55 0.22 260 / 0.5)',
  'oklch(0.68 0.16 75 / 0.5)',
]

export function PieChartCard({ title, data, suffix }: {
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

export default PieChartCard
