import { useState, useMemo, useEffect, useCallback, useDeferredValue, memo } from 'react'
import { MagnifyingGlass, ArrowDown, ArrowUp, CaretDown, CaretUp, Download } from '@phosphor-icons/react'
import type { DomainStats } from '../lib/types'
import { exportDomainCsv } from '../lib/csv'
import { fmtMs, fmtPct, fmtCount, filterAndSortDomains } from '../lib/format'
import type { SortKey } from '../lib/format'

interface DomainTableProps {
  domains: DomainStats[]
  onExpand?: (domain: string) => void
}

const cell = 'px-3 py-2.5 text-xs tabular-nums whitespace-nowrap'
const headerCell = `${cell} cursor-pointer select-none font-medium text-xs uppercase tracking-wider transition-colors hover:opacity-80`

const slowStyle = (v: number) => ({
  color: v > 1000 ? 'var(--c-danger)' : v > 500 ? 'var(--c-warning)' : 'inherit',
})

export function DomainTable({ domains }: DomainTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('p95')
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // 延迟搜索值：键入立即回显，500 行表格的重排序/重渲染滞后且可被后续键入中断
  const deferredSearch = useDeferredValue(search)

  const sorted = useMemo(() =>
    filterAndSortDomains(domains, deferredSearch, typeFilter, sortKey, sortDesc),
  [domains, deferredSearch, sortKey, sortDesc, typeFilter])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc)
    } else {
      setSortKey(key)
      setSortDesc(key === 'p95' || key === 'p60' || key === 'p70' || key === 'slowRate' || key === 'totalCount' || key === 'blockedCount')
    }
  }

  const toggleExpand = useCallback((domain: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }, [])

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return null
    return sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />
  }

  // Collect all query types across domains
  const allTypes = useMemo(() => {
    const types = new Set<string>()
    for (const d of domains) {
      for (const t of Object.keys(d.queryTypes)) types.add(t)
    }
    return ['all', ...Array.from(types).sort()]
  }, [domains])

  return (
    <div className="glass-card rounded-xl">
      {/* Header: title + search + type filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-2">
          <div className="h-3 w-1 rounded-full" style={{ background: 'var(--c-accent)' }} />
          <h3 className="text-sm font-medium">
            域名延时排行
          </h3>
          <span className="ml-1 text-xs" style={{ color: 'var(--c-text-secondary)' }}>
            {sorted.length} 个域名
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-glass)', color: 'var(--c-text)' }}
          >
            {allTypes.map(t => (
              <option key={t} value={t}>{t === 'all' ? '所有类型' : t}</option>
            ))}
          </select>
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-secondary)' }} />
            <input
              type="text"
              placeholder="搜索域名..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-40 rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none transition-all focus:w-56"
              style={{
                borderColor: 'var(--c-border)',
                background: 'var(--c-glass)',
                color: 'var(--c-text)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Table (scrollable on mobile) */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
              <th className={cell}></th>
              <th className={headerCell} onClick={() => toggleSort('domain')}>
                <span className="inline-flex items-center gap-1">域名 {sortArrow('domain')}</span>
              </th>
              <th className={cell}>类型</th>
              <th className={headerCell} onClick={() => toggleSort('totalCount')}>
                <span className="inline-flex items-center gap-1">次数 {sortArrow('totalCount')}</span>
              </th>
              <th className={cell}>缓存率</th>
              <th className={headerCell} onClick={() => toggleSort('blockedCount')}>
                <span className="inline-flex items-center gap-1">拦截 {sortArrow('blockedCount')}</span>
              </th>
              <th className={headerCell} onClick={() => toggleSort('p50')}>
                <span className="inline-flex items-center gap-1">P50 {sortArrow('p50')}</span>
              </th>
              <th className={headerCell} onClick={() => toggleSort('p60')}>
                <span className="inline-flex items-center gap-1">P60 {sortArrow('p60')}</span>
              </th>
              <th className={headerCell} onClick={() => toggleSort('p70')}>
                <span className="inline-flex items-center gap-1">P70 {sortArrow('p70')}</span>
              </th>
              <th className={headerCell} onClick={() => toggleSort('p95')}>
                <span className="inline-flex items-center gap-1">P95 {sortArrow('p95')}</span>
              </th>
              <th className={cell}>P99</th>
              <th className={headerCell} onClick={() => toggleSort('slowRate')}>
                <span className="inline-flex items-center gap-1">慢查询 {sortArrow('slowRate')}</span>
              </th>
              <th className={cell}>MAX</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <TableRow
                key={d.domain}
                stats={d}
                expanded={expanded.has(d.domain)}
                onToggle={toggleExpand}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="py-12 text-center text-xs" style={{ color: 'var(--c-text-secondary)' }}>
                  {search ? `没有域名匹配 "${search}"` : '暂无数据，请先刷新'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Individual row with optional expanded detail
function ExpandedDetail({ domain, topClients, topBlockRules }: { domain: string; topClients: DomainStats['topClients']; topBlockRules: DomainStats['topBlockRules'] }) {
  const [data, setData] = useState<{ domain: string; entries: Array<{ time: string; type: string; answer: Array<{ type: string; value: string; ttl: number }>; elapsedMs: number; cached: boolean; upstream: string; status: string }>; upstreams: Array<{ upstream: string; count: number; avg: number }> } | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)

  useEffect(() => {
    setLoading(true)
    setErr(false)
    // 使用查询参数避免 '.' 等特殊域名被 URL 路径标准化吃掉
    fetch(`/api/analysis/domain-detail?domain=${encodeURIComponent(domain)}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setLoading(false); setErr(true) })
  }, [domain])

  if (loading) return (
    <tr key={`${domain}-detail`}>
      <td colSpan={13} className="border-0 p-0">
        <div className="animate-pulse px-4 pb-3 pt-1" onClick={e => e.stopPropagation()}>
          <div className="min-h-[120px] rounded-lg p-4" style={{ background: 'var(--c-accent-soft)', border: '1px solid var(--c-border)' }} />
        </div>
      </td>
    </tr>
  )
  if (err || !data) return (
    <tr key={`${domain}-detail`}>
      <td colSpan={13} className="border-0 p-0">
        <div className="px-4 pb-3 pt-1">
          <div className="min-h-[120px] rounded-lg p-4 text-xs" style={{ background: 'var(--c-accent-soft)', border: '1px solid var(--c-border)' }}>
            <span style={{ color: 'var(--c-text-secondary)' }}>详情加载失败</span>
          </div>
        </div>
      </td>
    </tr>
  )

  // Collect unique answers across all entries with TTL info
  const answerMap = new Map<string, { type: string; count: number; minTtl: number; maxTtl: number }>()
  for (const e of data.entries) {
    for (const a of e.answer ?? []) {
      const key = `${a.type}:${a.value}`
      const existing = answerMap.get(key)
      if (existing) {
        existing.count++
        if (a.ttl !== undefined) {
          if (a.ttl < existing.minTtl) existing.minTtl = a.ttl
          if (a.ttl > existing.maxTtl) existing.maxTtl = a.ttl
        }
      } else {
        answerMap.set(key, { type: a.type, count: 1, minTtl: a.ttl, maxTtl: a.ttl })
      }
    }
  }
  const answers = Array.from(answerMap.entries()).sort((a, b) => b[1].count - a[1].count)

  return (
    <tr key={`${domain}-detail`}>
      <td colSpan={13} className="border-0 p-0">
        <div className="px-4 pb-3 pt-1" onClick={e => e.stopPropagation()}>
          <div className="rounded-lg p-4 text-xs" style={{ background: 'var(--c-accent-soft)', border: '1px solid var(--c-border)' }}>
            {/* Export button */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                域名详情 — {data.domain}
              </span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  const csv = exportDomainCsv(data.entries)
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${data.domain}-dns-log.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:opacity-80"
                style={{ background: 'var(--c-accent)', color: '#fff' }}
              >
                <Download size={12} />
                导出日志
              </button>
            </div>
            {/* Resolved addresses */}
            {answers.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>解析结果</div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {answers.map(([key, val]) => {
                    // Handle IPv6: split only on first colon
                    const colonIdx = key.indexOf(':')
                    const aType = key.slice(0, colonIdx)
                    const aValue = key.slice(colonIdx + 1)
                    const ttlText = val.minTtl !== undefined ? `TTL ${val.minTtl === val.maxTtl ? `${val.minTtl}s` : `${val.minTtl}~${val.maxTtl}s`}` : ''
                    return (
                      <span key={key} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono"
                        style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--c-accent)' }}>{aType}</span>
                        <span>{aValue}</span>
                        <span className="text-[10px]" style={{ color: 'var(--c-text-secondary)' }}>×{val.count}</span>
                        {ttlText && <span className="text-[10px]" style={{ color: 'var(--c-text-secondary)' }}>{ttlText}</span>}
                      </span>
                    )
                  })}
                </div>
              </>
            )}

            {/* Upstream breakdown */}
            {data.upstreams.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>上游服务器</div>
                <div className="mb-3 space-y-0.5">
                  {data.upstreams.map(u => (
                    <div key={u.upstream} className="flex items-center gap-3">
                      <span className="max-w-[200px] truncate font-mono text-[11px]">{u.upstream}</span>
                      <span style={{ color: 'var(--c-text-secondary)' }}>{u.count} 次</span>
                      <span style={{ color: 'var(--c-text-secondary)' }}>均 {u.avg}ms</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Client sources — topClients 在 DomainStats 中已预聚合，直接展示无需等待 API */}
            {topClients.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>客户端来源</div>
                <div className="mb-3 space-y-0.5">
                  {topClients.map(c => (
                    <div key={c.ip} className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[11px]">{c.ip}</span>
                        {c.name && (
                          <span className="text-[10px]" style={{ color: 'var(--c-text-secondary)' }}>({c.name})</span>
                        )}
                      </span>
                      <span style={{ color: 'var(--c-text-secondary)' }}>{c.count} 次</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Block rules */}
            {topBlockRules.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-danger)' }}>拦截规则</div>
                <div className="mb-3 space-y-0.5">
                  {topBlockRules.map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="max-w-[300px] truncate font-mono text-[11px]">{r.rule}</span>
                      <span className="text-[10px] whitespace-nowrap" style={{ color: 'var(--c-text-secondary)' }}>×{r.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Recent entries */}
            <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>最近查询</div>
            <div className="max-h-32 overflow-y-auto space-y-0.5">
              {data.entries.slice(0, 20).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-16 shrink-0 font-mono" style={{ color: 'var(--c-text-secondary)' }}>
                    {new Date(e.time).toLocaleTimeString()}
                  </span>
                  <span className="w-12 shrink-0 font-mono" style={{ color: e.elapsedMs > 500 ? 'var(--c-danger)' : 'inherit' }}>
                    {e.elapsedMs.toFixed(0)}ms
                  </span>
                  <span className="w-12 shrink-0 font-mono text-[10px]" style={{ color: 'var(--c-text-secondary)' }}>
                    {e.type}
                  </span>
                  {e.answer?.length > 0 ? (
                    <span className="truncate font-mono" style={{ color: 'var(--c-text-secondary)' }}>
                      {e.answer.map(a => `${a.value}${a.ttl ? ` (TTL=${a.ttl}s)` : ''}`).join(', ')}
                    </span>
                  ) : (
                    <span className="italic" style={{ color: 'var(--c-text-secondary)' }}>{e.status}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

// 行组件 memo 化：搜索/排序引发的全表重渲染中，props 未变的行直接跳过。
// onToggle 接收 domain 参数（useCallback 稳定引用），避免每行内联闭包破坏 memo。
const TableRow = memo(function TableRow({
  stats: d,
  expanded,
  onToggle,
}: {
  stats: DomainStats
  expanded: boolean
  onToggle: (domain: string) => void
}) {
  return (
    <>
      <tr
        className="cursor-pointer table-row-hover"
        style={{ borderBottom: '1px solid var(--c-border)' }}
        onClick={() => onToggle(d.domain)}
      >
        <td className={cell}>
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </td>
        <td className={`${cell} max-w-[180px] truncate font-mono text-xs`}>
          {d.domain}
        </td>
        <td className={cell}>
          <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
            {Object.entries(d.queryTypes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([t, c]) => `${t}:${fmtCount(c)}`)
              .join(' ')}
          </span>
        </td>
        <td className={cell}>{fmtCount(d.totalCount)}</td>
        <td className={cell}>
          <span style={{ color: d.cacheHitRate > 0.8 ? 'var(--c-success)' : 'var(--c-warning)' }}>
            {fmtPct(d.cacheHitRate)}
          </span>
        </td>
        <td className={cell}>
          {d.blockedCount > 0 ? (
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--c-danger)' }}>
              <span className="rounded-sm px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: 'oklch(0.58 0.22 27 / 0.12)' }}>
                {fmtCount(d.blockedCount)}
              </span>
              <span className="text-[10px]">{fmtPct(d.blockedRate)}</span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{fmtCount(0)}</span>
          )}
        </td>
        <td className={cell}>{fmtMs(d.uncached.p50)}</td>
        <td className={cell} style={slowStyle(d.uncached.p60)}>{fmtMs(d.uncached.p60)}</td>
        <td className={cell} style={slowStyle(d.uncached.p70)}>{fmtMs(d.uncached.p70)}</td>
        <td className={cell} style={slowStyle(d.uncached.p95)}>{fmtMs(d.uncached.p95)}</td>
        <td className={cell} style={slowStyle(d.uncached.p99)}>{fmtMs(d.uncached.p99)}</td>
        <td className={cell}>
          <span style={{ color: d.uncached.slowRate > 0.3 ? 'var(--c-danger)' : d.uncached.slowRate > 0.1 ? 'var(--c-warning)' : 'inherit' }}>
            {fmtPct(d.uncached.slowRate)}
          </span>
        </td>
        <td className={cell} style={slowStyle(d.uncached.max)}>{fmtMs(d.uncached.max)}</td>
      </tr>
      {expanded && (
        <ExpandedDetail domain={d.domain} topClients={d.topClients} topBlockRules={d.topBlockRules} />
      )}
    </>
  )
})
