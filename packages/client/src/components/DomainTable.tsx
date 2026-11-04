import { useState, useMemo, useEffect, useCallback, useDeferredValue, memo } from 'react'
import type { CSSProperties } from 'react'
import { MagnifyingGlass, ArrowDown, ArrowUp, CaretDown, CaretUp, Download } from '@phosphor-icons/react'
import type { DomainStats } from 'shared'
import { exportDomainCsv } from '../lib/csv'
import { fmtMs, fmtPct, fmtCount, filterAndSortDomains } from '../lib/format'
import type { SortKey } from '../lib/format'
import { useI18n } from '../lib/i18n'

interface DomainTableProps {
  domains: DomainStats[]
}

/** #16 首屏与每次「加载更多」渲染的行数 */
export const ROWS_PER_PAGE = 100

const cell = 'px-3 py-2.5 text-xs tabular-nums whitespace-nowrap'
const headerCell = `${cell} font-medium text-xs uppercase tracking-wider`

/**
 * #16 模块级样式常量。
 * 原来每行要新建 12 个字面量对象（slowStyle 一行就 5 个），500 行一次全表重渲染约 6000 个对象。
 * 现在全部复用同一批引用，行内不再分配。
 */
const STYLE_BORDER_BOTTOM: CSSProperties = { borderBottom: '1px solid var(--c-border)' }
const STYLE_MUTED: CSSProperties = { color: 'var(--c-text-secondary)' }
const STYLE_DANGER: CSSProperties = { color: 'var(--c-danger)' }
const STYLE_WARNING: CSSProperties = { color: 'var(--c-warning)' }
const STYLE_INHERIT: CSSProperties = { color: 'inherit' }
const STYLE_CACHE_OK: CSSProperties = { color: 'var(--c-success)' }
const STYLE_CACHE_WARN: CSSProperties = { color: 'var(--c-warning)' }
const STYLE_DANGER_PILL: CSSProperties = { background: 'oklch(0.58 0.22 27 / 0.12)' }
const STYLE_ACCENT_SOFT: CSSProperties = { background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }
const STYLE_ACCENT_SOLID: CSSProperties = { background: 'var(--c-accent)', color: '#fff' }

/** 延时着色：>1s 红、>500ms 黄，其余继承。返回模块级常量，不新建对象 */
function slowStyle(v: number): CSSProperties {
  return v > 1000 ? STYLE_DANGER : v > 500 ? STYLE_WARNING : STYLE_INHERIT
}

/** #33 表头排序按钮：整格可点改成真按钮，键盘可聚焦、回车/空格可触发；状态由 aria-sort 表达 */
function SortHeader({ label, column, sortKey, sortDesc, onSort }: {
  label: string
  column: SortKey
  sortKey: SortKey
  sortDesc: boolean
  onSort: (key: SortKey) => void
}) {
  const active = sortKey === column
  return (
    <th className={cell} aria-sort={active ? (sortDesc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className={`${headerCell} th-sort`} onClick={() => onSort(column)}>
        <span>{label}</span>
        {active && (sortDesc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  )
}

export function DomainTable({ domains }: DomainTableProps) {
  const { t } = useI18n()
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

  // #16 分批渲染：首屏只渲染 ROWS_PER_PAGE 行，其余按批加载。
  // 「回到第一页」放在改过滤/排序的事件里做（不在 effect 里 setState），数据变少时靠下面的 clamp 兜住。
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_PAGE)
  const shownCount = Math.min(visibleCount, sorted.length)
  const rows = useMemo(() => sorted.slice(0, shownCount), [sorted, shownCount])
  const hasMore = shownCount < sorted.length

  const toggleSort = (key: SortKey) => {
    setVisibleCount(ROWS_PER_PAGE)
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
          <h3 className="text-sm font-semibold" style={{ textWrap: 'balance' }}>
            {t('section.domainRank')}
          </h3>
          <span className="ml-1 text-xs" style={{ color: 'var(--c-text-secondary)' }}>
            {sorted.length} {t('domain.count')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setVisibleCount(ROWS_PER_PAGE) }}
            aria-label={t('domain.allTypes')}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none transition-colors"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-glass)', color: 'var(--c-text)' }}
          >
            {allTypes.map(type => (
              <option key={type} value={type}>{type === 'all' ? t('domain.allTypes') : type}</option>
            ))}
          </select>
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-secondary)' }} />
            <input
              type="text"
              aria-label={t('domain.search')}
              placeholder={t('domain.search')}
              value={search}
              onChange={e => { setSearch(e.target.value); setVisibleCount(ROWS_PER_PAGE) }}
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
            <tr style={STYLE_BORDER_BOTTOM}>
              <th className={cell}></th>
              <SortHeader label={t('table.domain')} column="domain" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <th className={cell}>{t('table.type')}</th>
              <SortHeader label={t('table.count')} column="totalCount" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <th className={cell}>{t('table.cacheRate')}</th>
              <SortHeader label={t('table.blocked')} column="blockedCount" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <SortHeader label={t('table.p50')} column="p50" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <SortHeader label={t('table.p60')} column="p60" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <SortHeader label={t('table.p70')} column="p70" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <SortHeader label={t('table.p95')} column="p95" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <th className={cell}>{t('table.p99')}</th>
              <SortHeader label={t('table.slowQuery')} column="slowRate" sortKey={sortKey} sortDesc={sortDesc} onSort={toggleSort} />
              <th className={cell}>{t('table.max')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <TableRow
                key={d.domain}
                stats={d}
                expanded={expanded.has(d.domain)}
                onToggle={toggleExpand}
              />
            ))}
            {hasMore && (
              <tr>
                <td colSpan={13} className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(shownCount + ROWS_PER_PAGE)}
                    className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium press-effect transition-opacity hover:opacity-80"
                    style={STYLE_ACCENT_SOFT}
                  >
                    {t('domain.loadMore')} · {rows.length}/{sorted.length}
                  </button>
                </td>
              </tr>
            )}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={13} className="py-12 text-center text-xs" style={STYLE_MUTED}>
                  {search ? `${t('domain.noMatch')} "${search}"` : t('domain.noData')}
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
  const { t } = useI18n()
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
            <span style={{ color: 'var(--c-text-secondary)' }}>{t('domain.detailFail')}</span>
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
                {t('domain.detail')} — {data.domain}
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
                style={STYLE_ACCENT_SOLID}
              >
                <Download size={12} />
                {t('domain.export')}
              </button>
            </div>
            {/* Resolved addresses */}
            {answers.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>{t('domain.resolveResult')}</div>
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
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>{t('domain.upstream')}</div>
                <div className="mb-3 space-y-0.5">
                  {data.upstreams.map(u => (
                    <div key={u.upstream} className="flex items-center gap-3">
                      <span className="max-w-[200px] truncate font-mono text-[11px]">{u.upstream}</span>
                      <span style={{ color: 'var(--c-text-secondary)' }}>{u.count} {t('domain.times')}</span>
                      <span style={{ color: 'var(--c-text-secondary)' }}>{t('domain.avg')} {u.avg}ms</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Client sources — topClients 在 DomainStats 中已预聚合，直接展示无需等待 API */}
            {topClients.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>{t('domain.clientSource')}</div>
                <div className="mb-3 space-y-0.5">
                  {topClients.map(c => (
                    <div key={c.ip} className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[11px]">{c.ip}</span>
                        {c.name && (
                          <span className="text-[10px]" style={{ color: 'var(--c-text-secondary)' }}>({c.name})</span>
                        )}
                      </span>
                      <span style={{ color: 'var(--c-text-secondary)' }}>{c.count} {t('domain.times')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Block rules */}
            {topBlockRules.length > 0 && (
              <>
                <div className="mb-1.5 font-medium" style={{ color: 'var(--c-danger)' }}>{t('domain.blockRules')}</div>
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
            <div className="mb-1.5 font-medium" style={{ color: 'var(--c-text-secondary)' }}>{t('domain.recentQueries')}</div>
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
        style={STYLE_BORDER_BOTTOM}
        onClick={() => onToggle(d.domain)}
      >
        <td className={cell}>
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </td>
        <td className={`${cell} max-w-[180px] truncate font-mono text-xs`}>
          {d.domain}
        </td>
        <td className={cell}>
          <span className="text-xs" style={STYLE_MUTED}>
            {Object.entries(d.queryTypes)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 3)
              .map(([t, c]) => `${t}:${fmtCount(c)}`)
              .join(' ')}
          </span>
        </td>
        <td className={cell}>{fmtCount(d.totalCount)}</td>
        <td className={cell}>
          <span style={d.cacheHitRate > 0.8 ? STYLE_CACHE_OK : STYLE_CACHE_WARN}>
            {fmtPct(d.cacheHitRate)}
          </span>
        </td>
        <td className={cell}>
          {d.blockedCount > 0 ? (
            <span className="inline-flex items-center gap-1" style={STYLE_DANGER}>
              <span className="rounded-sm px-1.5 py-0.5 text-[11px] font-medium" style={STYLE_DANGER_PILL}>
                {fmtCount(d.blockedCount)}
              </span>
              <span className="text-[10px]">{fmtPct(d.blockedRate)}</span>
            </span>
          ) : (
            <span className="text-xs" style={STYLE_MUTED}>{fmtCount(0)}</span>
          )}
        </td>
        <td className={cell}>{fmtMs(d.uncached.p50)}</td>
        <td className={cell} style={slowStyle(d.uncached.p60)}>{fmtMs(d.uncached.p60)}</td>
        <td className={cell} style={slowStyle(d.uncached.p70)}>{fmtMs(d.uncached.p70)}</td>
        <td className={cell} style={slowStyle(d.uncached.p95)}>{fmtMs(d.uncached.p95)}</td>
        <td className={cell} style={slowStyle(d.uncached.p99)}>{fmtMs(d.uncached.p99)}</td>
        <td className={cell}>
          <span style={d.uncached.slowRate > 0.3 ? STYLE_DANGER : d.uncached.slowRate > 0.1 ? STYLE_WARNING : STYLE_INHERIT}>
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
