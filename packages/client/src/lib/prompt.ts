import type { DomainStats } from '../lib/types'
import type { AnalysisSummary } from '../lib/types'

function fmtMs(n: number) { return `${n.toFixed(0)}ms` }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%` }
function fmtCount(n: number) { return n.toLocaleString() }

export function buildPrompt(summary: AnalysisSummary | null, domains: DomainStats[]): string {
  const lines: string[] = []

  lines.push('# AdGuardHome DNS 查询延时分析')
  lines.push('')
  lines.push('## 背景')
  lines.push('这是 AdGuardHome DNS 查询延时分析工具的统计数据，展示了过去 24 小时内各域名的 DNS 解析性能表现。')
  lines.push('数据已按域名聚合，延时指标包括 P20/P50/P80/P95/P99/Max/Avg/Min，并区分了缓存命中与上游真实性能。')
  if (summary?.adguardUrl) {
    lines.push(`- 数据来源: ${summary.adguardUrl}`)
  }
  if (summary?.lastUpdated) {
    lines.push(`- 最后更新: ${new Date(summary.lastUpdated).toLocaleString()}`)
  }
  lines.push('')

  if (domains.length === 0) {
    lines.push('暂无数据。')
    lines.push('')
    lines.push('## 我的问题')
    lines.push('')
    return lines.join('\n')
  }

  // Summary stats
  const totalCount = domains.reduce((s, d) => s + d.totalCount, 0)
  const totalCached = domains.reduce((s, d) => s + d.cachedCount, 0)
  const cacheRate = totalCount > 0 ? totalCached / totalCount : 0
  const p50avg = domains.reduce((s, d) => s + d.uncached.p50, 0) / domains.length
  const p95avg = domains.reduce((s, d) => s + d.uncached.p95, 0) / domains.length

  lines.push('## 概览统计')
  lines.push(`| 指标 | 值 |`)
  lines.push(`|------|-----|`)
  lines.push(`| 总域名 | ${domains.length} |`)
  lines.push(`| 总查询 | ${fmtCount(totalCount)} |`)
  lines.push(`| 缓存命中率 | ${fmtPct(cacheRate)} |`)
  lines.push(`| 平均 P50 (uncached) | ${fmtMs(p50avg)} |`)
  lines.push(`| 平均 P95 (uncached) | ${fmtMs(p95avg)} |`)
  lines.push(`| 慢查询域名 (>500ms) | ${domains.filter(d => d.uncached.p95 > 500).length} |`)
  lines.push(`| 严重域名 (>1s) | ${domains.filter(d => d.uncached.p95 > 1000).length} |`)
  lines.push('')

  // Top slowest domains (by P95)
  const top = [...domains].sort((a, b) => b.uncached.p95 - a.uncached.p95).slice(0, 10)
  lines.push('## Top 10 慢域名 (按 P95 排序)')
  lines.push(`| 域名 | 查询数 | 缓存率 | P50 | P95 | P99 | MAX | 慢查询率 | 类型 |`)
  lines.push(`|------|--------|--------|-----|-----|-----|-----|---------|------|`)

  for (const d of top) {
    const types = Object.entries(d.queryTypes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([t, c]) => `${t}:${c}`)
      .join(' ')

    lines.push(`| ${d.domain} | ${fmtCount(d.totalCount)} | ${fmtPct(d.cacheHitRate)} | ${fmtMs(d.uncached.p50)} | ${fmtMs(d.uncached.p95)} | ${fmtMs(d.uncached.p99)} | ${fmtMs(d.uncached.max)} | ${fmtPct(d.uncached.slowRate)} | ${types} |`)
  }
  lines.push('')

  lines.push('## 我的问题')
  lines.push('')

  return lines.join('\n')
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
  }
  // Fallback
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return Promise.resolve(ok)
  } catch {
    return Promise.resolve(false)
  }
}
