import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface TrendChartProps {
  history: Array<{ queries: number; blocked: number }>
  timeUnit: string
}

export function TrendChart({ history, timeUnit }: TrendChartProps) {
  const unitLabel = timeUnit === 'days' ? '天' : timeUnit
  const chartData = useMemo(() => history.map((h, i) => ({ ...h, index: i })), [history])

  if (!history || history.length === 0) return null

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-accent)' }} />
        <h3 className="text-sm font-medium">查询趋势</h3>
        <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
          过去 {history.length} {unitLabel}
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
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
              labelFormatter={(i: any) => `第 ${i + 1} ${unitLabel}`}
            />
            <Area type="monotone" dataKey="queries" stroke="var(--c-accent)" strokeWidth={2} fill="url(#queriesGrad)" name="查询数" isAnimationActive={false} />
            <Area type="monotone" dataKey="blocked" stroke="var(--c-danger)" strokeWidth={1.5} fill="url(#blockedGrad)" name="已屏蔽" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default TrendChart
