import { useState, useMemo, useEffect } from 'react'
import { MagnifyingGlass, ArrowDown, ArrowUp, CaretDown, CaretUp } from '@phosphor-icons/react'
import type { DomainStats } from '../lib/types'

interface DomainTableProps {
  domains: DomainStats[]
  onExpand?: (domain: string) => void
}

type SortKey = 'domain' | 'p95' | 'p50' | 'cacheHitRate' | 'slowRate' | 'totalCount'

export function DomainTable({ domains }: DomainTableProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('p95')
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const sorted = useMemo(() => {
    let filtered = domains.filter(d => d.domain.toLowerCase().includes(search.toLowerCase()))
    if (typeFilter !== 'all') {
      filtered = filtered.filter(d => d.queryTypes[typeFilter] > 0)
    }
    return [...filtered].sort((a, b) => {
      let va: number | string, vb: number | string
      switch (sortKey) {
        case 'domain': va = a.domain; vb = b.domain; break
        case 'p95': va = a.uncached.p95; vb = b.uncached.p95; break
        case 'p50': va = a.uncached.p50; vb = b.uncached.p50; break
        case 'cacheHitRate': va = a.cacheHitRate; vb = b.cacheHitRate; break
        case 'slowRate': va = a.uncached.slowRate; vb = b.uncached.slowRate; break
        case 'totalCount': va = a.totalCount; vb = b.totalCount; break
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDesc ? vb.localeCompare(va) : va.localeCompare(vb)
      }
      const na = va as number, nb = vb as number
      return sortDesc ? nb - na : na - nb
    })
  }, [domains, search, sortKey, sortDesc, typeFilter])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc)
    } else {
      setSortKey(key)
      setSortDesc(key === 'p95' || key === 'slowRate' || key === 'totalCount')
    }
  }

  const toggleExpand = (domain: string) => {
    const next = new Set(expanded)
    if (next.has(domain)) next.delete(domain)
    else next.add(domain)
    setExpanded(next)
  }

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

  const fmtMs = (n: number) => `${n.toFixed(0)}ms`
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`
  const fmtCount = (n: number) => n.toLocaleString()

  const cell = 'px-3 py-2.5 text-xs tabular-nums whitespace-nowrap'
  const headerCell = `${cell} cursor-pointer select-none font-medium text-xs uppercase tracking-wider transition-colors hover:opacity-80`

  const slowStyle = (v: number) => ({
    color: v > 1000 ? 'var(--c-danger)' : v > 500 ? 'var(--c-warning)' : 'inherit',
  })

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
              <th className={headerCell} onClick={() => toggleSort('p50')}>
                <span className="inline-flex items-center gap-1">P50 {sortArrow('p50')}</span>
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
                onToggle={() => toggleExpand(d.domain)}
                fmtMs={fmtMs}
                fmtPct={fmtPct}
                fmtCount={fmtCount}
                slowStyle={slowStyle}
                cell={cell}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-xs" style={{ color: 'var(--c-text-secondary)' }}>
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
function ExpandedDetail({ domain }: { domain: string }) {
  const [data, setData] = useState<{ domain: string; entries: Array<{ time: string; type: string; answer: Array<{ type: string; value: string }>; elapsedMs: number; cached: boolean; status: string }>; upstreams: Array<{ upstream: string; count: number; avg: number }> } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analysis/domains/${encodeURIComponent(domain)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [domain])

  if (loading) return <div className="px-4 pb-3 pt-1"><span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>加载中...</span></div>
  if (!data) return null

  // Collect unique answers across all entries
  const answerMap = new Map<string, { type: string; count: number }>()
  for (const e of data.entries) {
    for (const a of e.answer ?? []) {
      const key = `${a.type}:${a.value}`
      const existing = answerMap.get(key)
      if (existing) existing.count++
      else answerMap.set(key, { type: a.type, count: 1 })
    }
  }
  const answers = Array.from(answerMap.entries()).sort((a, b) => b[1].count - a[1].count)

  return (
    <tr key={`${domain}-detail`}>
      <td colSpan={10} className="border-0 p-0">
        <div className="px-4 pb-3 pt-1">
          <div className="rounded-lg p-4 text-xs" style={{ background: 'var(--c-accent-soft)', border: '1px solid var(--c-border)' }}>
            {/* Resolved addresses */}
            {answers.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>解析结果</div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {answers.map(([key, val]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono"
                      style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--c-accent)' }}>{val.type}</span>
                      <span>{key.split(':')[1]}</span>
                      <span className="text-[10px]" style={{ color: 'var(--c-text-secondary)' }}>×{val.count}</span>
                    </span>
                  ))}
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
                  {e.answer?.length > 0 && (
                    <span className="truncate font-mono" style={{ color: 'var(--c-text-secondary)' }}>
                      {e.answer.map(a => a.value).join(', ')}
                    </span>
                  )}
                  {!e.answer?.length && (
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

function TableRow({
  stats: d,
  expanded,
  onToggle,
  fmtMs,
  fmtPct,
  fmtCount,
  slowStyle,
  cell,
}: {
  stats: DomainStats
  expanded: boolean
  onToggle: () => void
  fmtMs: (n: number) => string
  fmtPct: (n: number) => string
  fmtCount: (n: number) => string
  slowStyle: (v: number) => Record<string, string>
  cell: string
}) {
  return (
    <>
      <tr
        className="cursor-pointer table-row-hover"
        style={{ borderBottom: '1px solid var(--c-border)' }}
        onClick={onToggle}
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
        <td className={cell}>{fmtMs(d.uncached.p50)}</td>
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
        <ExpandedDetail domain={d.domain} />
      )}
    </>
  )
}
