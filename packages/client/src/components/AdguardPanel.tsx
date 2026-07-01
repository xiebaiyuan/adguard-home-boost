import { useState } from 'react'
import { Trash, Plus, Prohibit } from '@phosphor-icons/react'
import { useAdguard } from '../hooks/useAdguard'

export function AdguardPanel() {
  const {
    status, loading, error, saving, rewrites,
    toggleSafebrowsing, toggleParental,
    setUserRules, addRewrite, deleteRewrite,
    resetStats, clearLog,
  } = useAdguard()

  const [rulesText, setRulesText] = useState('')
  const [rulesDirty, setRulesDirty] = useState(false)
  const [newRewriteDomain, setNewRewriteDomain] = useState('')
  const [newRewriteAnswer, setNewRewriteAnswer] = useState('')

  const handleSaveRules = async () => {
    await setUserRules(rulesText)
    setRulesDirty(false)
  }

  const handleAddRewrite = async () => {
    if (!newRewriteDomain || !newRewriteAnswer) return
    await addRewrite(newRewriteDomain, newRewriteAnswer)
    setNewRewriteDomain('')
    setNewRewriteAnswer('')
  }

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded" style={{ background: 'var(--c-border)' }} />
          <div className="h-20 rounded" style={{ background: 'var(--c-border)' }} />
        </div>
      </div>
    )
  }

  if (error || !status) return null

  // Initialize rules text from status
  if (!rulesDirty && rulesText === '' && status.userRules) {
    setRulesText(status.userRules)
  }

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Prohibit size={16} style={{ color: 'var(--c-accent)' }} />
        <h3 className="text-sm font-medium">AdGuardHome 管理</h3>
        {status.version && (
          <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>
            v{status.version}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-5">
          {/* Toggle switches */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>安全功能</h4>
            <div className="space-y-2">
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
            </div>
          </div>

          {/* Custom filtering rules */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>自定义过滤规则</h4>
            <textarea
              value={rulesText}
              onChange={e => { setRulesText(e.target.value); setRulesDirty(true) }}
              className="w-full rounded-lg border p-3 text-xs font-mono outline-none transition-colors"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', minHeight: 120 }}
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
          </div>

          {/* Active filters info */}
          {status.filters.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>已启用过滤器</h4>
              <div className="space-y-1">
                {status.filters.map(f => (
                  <div key={f.name} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--c-success)' }} />
                    <span>{f.name}</span>
                    {f.rulesCount != null && (
                      <span className="text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{f.rulesCount} 条规则</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* DNS Rewrites */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>DNS 重写</h4>
            <div className="mb-2 space-y-1">
              {rewrites.length === 0 && (
                <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>暂无重写规则</span>
              )}
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
            <div className="flex items-center gap-2">
              <input
                value={newRewriteDomain}
                onChange={e => setNewRewriteDomain(e.target.value)}
                placeholder="域名"
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
              />
              <input
                value={newRewriteAnswer}
                onChange={e => setNewRewriteAnswer(e.target.value)}
                placeholder="目标 IP"
                className="w-24 rounded-lg border px-2 py-1.5 text-xs outline-none"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
              />
              <button
                onClick={handleAddRewrite}
                disabled={!newRewriteDomain || !newRewriteAnswer}
                className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)', border: 'none' }}
              >
                <Plus size={12} />
                添加
              </button>
            </div>
          </div>

          {/* Maintenance */}
          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text-secondary)' }}>维护</h4>
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
          </div>
        </div>
      </div>
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
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4.5' : 'translate-x-1'}`}
          style={{ transform: enabled ? 'translateX(18px)' : 'translateX(3px)' }}
        />
      </button>
    </div>
  )
}
