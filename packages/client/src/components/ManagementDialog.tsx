import { useState, useEffect } from 'react'
import { Trash, Plus, X } from '@phosphor-icons/react'
import { useAdguard } from '../hooks/useAdguard'

interface ManagementDialogProps {
  open: boolean
  onClose: () => void
}

export function ManagementDialog({ open, onClose }: ManagementDialogProps) {
  const {
    status, loading, error, saving, rewrites,
    toggleSafebrowsing, toggleParental,
    setUserRules, addRewrite, deleteRewrite,
    addFilterUrl,
    resetStats, clearLog,
  } = useAdguard()

  const [rulesText, setRulesText] = useState('')
  const [rulesDirty, setRulesDirty] = useState(false)

  useEffect(() => {
    if (status?.userRules !== undefined && !rulesDirty) {
      setRulesText(status.userRules)
    }
  }, [status?.userRules, rulesDirty])

  const handleSaveRules = async () => {
    await setUserRules(rulesText)
    setRulesDirty(false)
  }

  const handleAddRewrite = async () => {
    if (!rewriteDomain || !rewriteAnswer) return
    await addRewrite(rewriteDomain, rewriteAnswer)
    setRewriteDomain('')
    setRewriteAnswer('')
  }

  const [rewriteDomain, setRewriteDomain] = useState('')
  const [rewriteAnswer, setRewriteAnswer] = useState('')
  const [filterUrl, setFilterUrl] = useState('')
  const [filterName, setFilterName] = useState('')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 sm:pt-16"
      style={{ background: 'oklch(0 0 0 / 0.4)' }}
      onClick={onClose}
    >
      <div
        className="glass-card mb-8 w-full max-w-2xl rounded-2xl p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">AdGuardHome 管理</span>
            {status?.version && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
                v{status.version}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:opacity-60"
            style={{ color: 'var(--c-text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4 py-8">
            <div className="h-4 w-32 rounded" style={{ background: 'var(--c-border)' }} />
            <div className="h-24 rounded" style={{ background: 'var(--c-border)' }} />
          </div>
        ) : error ? (
          <div className="rounded-lg px-4 py-3 text-xs" style={{ background: 'oklch(0.58 0.22 27 / 0.1)', color: 'var(--c-danger)' }}>
            {error}
          </div>
        ) : status && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Left: Security toggles + Filters */}
            <div className="space-y-5">
              <Section title="安全功能">
                <ToggleRow
                  label="安全浏览"
                  desc="拦截恶意和钓鱼网站"
                  enabled={status.safebrowsingEnabled}
                  saving={saving === 'safebrowsing'}
                  onToggle={toggleSafebrowsing}
                />
                <ToggleRow
                  label="家长控制"
                  desc="拦截成人内容"
                  enabled={status.parentalEnabled}
                  saving={saving === 'parental'}
                  onToggle={toggleParental}
                />
              </Section>

              <Section title="自定义过滤规则">
                <textarea
                  value={rulesText}
                  onChange={e => { setRulesText(e.target.value); setRulesDirty(true) }}
                  className="w-full rounded-lg border p-3 text-xs font-mono outline-none transition-colors"
                  style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', minHeight: 140 }}
                  placeholder="每行一条规则，例如：||example.com^"
                />
                {rulesDirty && (
                  <button
                    onClick={handleSaveRules}
                    disabled={saving === 'rules'}
                    className="mt-2 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-60"
                    style={{ background: 'var(--c-accent-gradient)', border: 'none' }}
                  >
                    {saving === 'rules' ? '保存中...' : '保存规则'}
                  </button>
                )}
              </Section>

              {status.filters.length > 0 && (
                <Section title="过滤器">
                  {status.filters.map(f => (
                    <div key={f.name} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--c-border)' }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: f.enabled ? 'var(--c-success)' : 'var(--c-text-secondary)' }} />
                      <span className="flex-1 truncate">{f.name}</span>
                      {f.rulesCount != null && (
                        <span className="shrink-0 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{f.rulesCount} 条</span>
                      )}
                      {!f.enabled && (
                        <span className="shrink-0 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>已禁用</span>
                      )}
                    </div>
                  ))}
                  {/* Add filter URL subscription */}
                  <div className="pt-2">
                    <div className="mb-1 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>添加过滤器订阅</div>
                    <div className="flex items-center gap-2">
                      <input
                        value={filterName}
                        onChange={e => setFilterName(e.target.value)}
                        placeholder="名称"
                        className="w-20 rounded-lg border px-2 py-1.5 text-xs outline-none"
                        style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                      />
                      <input
                        value={filterUrl}
                        onChange={e => setFilterUrl(e.target.value)}
                        placeholder="URL"
                        className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
                        style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                      />
                      <button
                        onClick={async () => {
                          if (!filterName || !filterUrl) return
                          await addFilterUrl(filterName, filterUrl)
                          setFilterName('')
                          setFilterUrl('')
                        }}
                        disabled={saving === 'filter' || !filterName || !filterUrl}
                        className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)', border: 'none' }}
                      >
                        <Plus size={12} />
                        添加
                      </button>
                    </div>
                  </div>
                </Section>
              )}
            </div>

            {/* Right: DNS Rewrites + Maintenance */}
            <div className="space-y-5">
              <Section title="DNS 重写">
                {rewrites.length === 0 ? (
                  <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>暂无重写规则</span>
                ) : (
                  <div className="mb-2 space-y-1">
                    {rewrites.map(r => (
                      <div key={`${r.domain}->${r.answer}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--c-border)' }}>
                        <span className="flex-1 truncate font-mono">{r.domain} → {r.answer}</span>
                        <button
                          onClick={() => deleteRewrite(r.domain, r.answer)}
                          className="flex shrink-0 cursor-pointer p-1 transition-colors hover:opacity-60"
                          style={{ color: 'var(--c-text-secondary)' }}
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={rewriteDomain}
                    onChange={e => setRewriteDomain(e.target.value)}
                    placeholder="域名"
                    className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
                    style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                  />
                  <input
                    value={rewriteAnswer}
                    onChange={e => setRewriteAnswer(e.target.value)}
                    placeholder="目标 IP"
                    className="w-24 rounded-lg border px-2 py-1.5 text-xs outline-none"
                    style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                  />
                  <button
                    onClick={handleAddRewrite}
                    disabled={!rewriteDomain || !rewriteAnswer}
                    className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
                    style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)', border: 'none' }}
                  >
                    <Plus size={12} />
                    添加
                  </button>
                </div>
              </Section>

              <Section title="维护">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={resetStats}
                    disabled={saving === 'reset'}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
                    style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                  >
                    <Trash size={12} />
                    {saving === 'reset' ? '重置中...' : '重置统计'}
                  </button>
                  <button
                    onClick={clearLog}
                    disabled={saving === 'clear'}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40"
                    style={{ borderColor: 'var(--c-border)', color: 'var(--c-danger)' }}
                  >
                    <Trash size={12} />
                    {saving === 'clear' ? '清空中...' : '清空查询日志'}
                  </button>
                </div>
              </Section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ToggleRow({ label, desc, enabled, saving, onToggle }: {
  label: string
  desc: string
  enabled: boolean
  saving: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: 'var(--c-border)' }}>
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{desc}</div>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        disabled={saving}
        className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${saving ? 'opacity-60' : ''}`}
        style={{ background: enabled ? 'var(--c-success)' : 'var(--c-border)' }}
      >
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
          style={{ transform: enabled ? 'translateX(18px)' : 'translateX(3px)' }} />
      </button>
    </div>
  )
}
