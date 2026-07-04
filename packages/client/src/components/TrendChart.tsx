import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useI18n } from '../lib/i18n'

/** 裁剪前导全零条目，使图表从第一个有数据的日期开始 */
export function trimLeadingZeros(data: Array<{ queries: number; blocked: number }>): Array<{ queries: number; blocked: number }> {
  const firstNonZero = data.findIndex(d => d.queries > 0 || d.blocked > 0)
  if (firstNonZero <= 0) return data
  return data.slice(firstNonZero)
}

/** 从 history 长度倒推日期标签 */
function computeDateLabels(length: number): string[] {
  const labels: string[] = []
  const today = new Date()
  for (let i = 0; i < length; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - (length - 1 - i))
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
  }
  return labels
}

/** 简单移动平均 */
function sma(values: number[], window: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) { result.push(null); continue }
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += values[j]
    result.push(Math.round(sum / window))
  }
  return result
}

/** 自定义 Tooltip：显示查询、屏蔽、屏蔽率、均线 */
function ChartTooltip({ active, payload, label }: any) {
  const { t } = useI18n()
  if (!active || !payload?.length) return null
  const queries = payload.find((p: any) => p.dataKey === 'queries')?.value ?? 0
  const blocked = payload.find((p: any) => p.dataKey === 'blocked')?.value ?? 0
  const rate = payload.find((p: any) => p.dataKey === 'blockedRate')?.value ?? 0
  const smaVal = payload.find((p: any) => p.dataKey === 'sma')?.value

  return (
    <div className="glass-card rounded-lg px-3 py-2 text-xs shadow-lg" style={{ minWidth: 140 }}>
      <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text)' }}>{label}</div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--c-accent)' }} />
          <span style={{ color: 'var(--c-text-secondary)' }}>{t('chart.tooltip.queries')}</span>
          <span className="ml-auto tabular-nums font-medium" style={{ color: 'var(--c-text)' }}>{queries.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--c-danger)' }} />
          <span style={{ color: 'var(--c-text-secondary)' }}>{t('chart.tooltip.blocked')}</span>
          <span className="ml-auto tabular-nums font-medium" style={{ color: 'var(--c-danger)' }}>{blocked.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--c-success)' }} />
          <span style={{ color: 'var(--c-text-secondary)' }}>{t('chart.tooltip.blockRate')}</span>
          <span className="ml-auto tabular-nums font-medium" style={{ color: 'var(--c-text)' }}>{rate}%</span>
        </div>
        {smaVal != null && (
          <div className="pt-0.5 text-[10px]" style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-text-secondary)' }}>
            {t('chart.tooltip.sma3')} {smaVal.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}

interface TrendChartProps {
  history: Array<{ queries: number; blocked: number }>
  timeUnit: string
}

export function TrendChart({ history }: TrendChartProps) {
  const { t } = useI18n()
  const { chartData, dateRange } = useMemo(() => {
    const trimmed = trimLeadingZeros(history)
    const allLabels = computeDateLabels(history.length)
    const slicedLabels = allLabels.slice(allLabels.length - trimmed.length)
    const queriesData = trimmed.map(h => h.queries)
    const smaValues = sma(queriesData, 3)

    const data = trimmed.map((h, i) => ({
      ...h,
      date: slicedLabels[i] ?? '',
      blockedRate: h.queries + h.blocked > 0
        ? Math.round((h.blocked / (h.queries + h.blocked)) * 100)
        : 0,
      sma: smaValues[i],
    }))

    const range = slicedLabels.length > 1
      ? `${slicedLabels[0]} → ${slicedLabels[slicedLabels.length - 1]}`
      : slicedLabels[0] ?? ''

    return { chartData: data, dateRange: range }
  }, [history])

  if (!chartData || chartData.length === 0) return null

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-accent)' }} />
        <h3 className="text-sm font-semibold" style={{ textWrap: 'balance' }}>{t('section.trend')}</h3>
        {dateRange && (
          <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{dateRange}</span>
        )}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="queriesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--c-accent)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="blockedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--c-danger)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--c-danger)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* 左轴：查询/屏蔽数量 */}
            <YAxis yAxisId="left"
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
              axisLine={false} tickLine={false} width={40}
            />
            {/* 右轴：屏蔽率 % */}
            <YAxis yAxisId="right" orientation="right"
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
              axisLine={false} tickLine={false} width={32}
              domain={[0, 100]}
              tickFormatter={v => `${v}%`}
            />

            <XAxis dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
              axisLine={false} tickLine={false} interval="preserveStartEnd"
            />

            <Tooltip content={<ChartTooltip />} />

            {/* 查询量（左轴） */}
            <Area yAxisId="left" type="monotone" dataKey="queries"
              stroke="var(--c-accent)" strokeWidth={2} fill="url(#queriesGrad)"
              name="查询数" isAnimationActive={true} animationDuration={600}
            />
            {/* 屏蔽量（左轴） */}
            <Area yAxisId="left" type="monotone" dataKey="blocked"
              stroke="var(--c-danger)" strokeWidth={1.5} fill="url(#blockedGrad)"
              name="已屏蔽" isAnimationActive={true} animationDuration={600}
            />
            {/* 屏蔽率（右轴）虚线 */}
            <Area yAxisId="right" type="monotone" dataKey="blockedRate"
              stroke="var(--c-success)" strokeWidth={1.5} fill="none" strokeDasharray="3 3"
              name="屏蔽率" isAnimationActive={false}
            />
            {/* 3 日均线（左轴） */}
            <Area yAxisId="left" type="monotone" dataKey="sma"
              stroke="var(--c-accent)" strokeWidth={1.5} fill="none" strokeDasharray="4 4"
              name="3日均线" isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default TrendChart
