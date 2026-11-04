import { useState, useEffect } from 'react'
import { Trash, Plus, X, PencilSimple } from '@phosphor-icons/react'
import type { AdguardApi } from '../hooks/useAdguard'
import { useI18n } from '../lib/i18n'
import { useModalDialog } from '../hooks/useModalDialog'

interface ManagementDialogProps {
  open: boolean
  onClose: () => void
  /** #13 由 Dashboard 持有唯一一份 useAdguard，这里只负责渲染 */
  adguard: AdguardApi
}

export function ManagementDialog({ open, onClose, adguard }: ManagementDialogProps) {
  const { t } = useI18n()
  const panelRef = useModalDialog({ open, onClose })
  const {
    status, loading, error, saving, actionError, rewrites,
    toggleSafebrowsing, toggleParental,
    setUserRules, addRewrite, deleteRewrite,
    addFilterUrl, removeFilterUrl,
    setFilterEnabled, updateFilterUrl,
    resetStats, clearLog,
  } = adguard

  const [rulesText, setRulesText] = useState('')
  const [rulesDirty, setRulesDirty] = useState(false)
  const [rewriteDomain, setRewriteDomain] = useState('')
  const [rewriteAnswer, setRewriteAnswer] = useState('')
  const [filterUrl, setFilterUrl] = useState('')
  const [filterName, setFilterName] = useState('')
  const [editingFilter, setEditingFilter] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editUrl, setEditUrl] = useState('')

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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-8 sm:pt-16"
      style={{ background: 'oklch(0 0 0 / 0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-dialog-title"
        className="glass-card mb-8 w-full max-w-2xl rounded-2xl p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span id="manage-dialog-title" className="text-sm font-medium">{t('dialog.manage.title')}</span>
            {status?.version && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)' }}>
                v{status.version}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dialog.close')}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg press-effect transition-colors hover:opacity-60"
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
          <>
            {/* #14 动作失败的就近提示，不再只留一条 unhandled rejection */}
            {actionError && (
              <div role="alert" className="mb-4 rounded-lg px-4 py-3 text-xs" style={{ background: 'oklch(0.58 0.22 27 / 0.1)', color: 'var(--c-danger)' }}>
                {actionError}
              </div>
            )}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left: Security toggles + Filters */}
              <div className="space-y-5">
                <Section title={t('dialog.manage.security')}>
                  <ToggleRow
                    label={t('dialog.manage.safebrowsing')}
                    desc={t('dialog.manage.safebrowsingDesc')}
                    enabled={status.safebrowsingEnabled}
                    saving={saving === 'safebrowsing'}
                    onToggle={toggleSafebrowsing}
                  />
                  <ToggleRow
                    label={t('dialog.manage.parental')}
                    desc={t('dialog.manage.parentalDesc')}
                    enabled={status.parentalEnabled}
                    saving={saving === 'parental'}
                    onToggle={toggleParental}
                  />
                </Section>

                <Section title={t('dialog.manage.customRules')}>
                  <textarea
                    value={rulesText}
                    onChange={e => { setRulesText(e.target.value); setRulesDirty(true) }}
                    aria-label={t('dialog.manage.customRules')}
                    className="w-full rounded-lg border p-3 text-xs font-mono outline-none transition-colors"
                    style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', minHeight: 140 }}
                    placeholder={t('dialog.manage.rulesPlaceholder')}
                  />
                  {rulesDirty && (
                    <button
                      type="button"
                      onClick={handleSaveRules}
                      disabled={saving === 'rules'}
                      className="mt-2 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-white press-effect transition-opacity disabled:opacity-60"
                      style={{ background: 'var(--c-accent-gradient)', border: 'none' }}
                    >
                      {saving === 'rules' ? t('dialog.saving') : t('dialog.manage.saveRules')}
                    </button>
                  )}
                </Section>

                {status.filters.length > 0 && (
                  <Section title={t('dialog.manage.filtersHint')}>
                    {status.filters.map(f => {
                      const filterUrlValue = f.url
                      return (
                        <div key={f.name}>
                          {editingFilter === filterUrlValue && filterUrlValue ? (
                            <div className="mb-2 rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--c-accent)' }}>
                              <input value={editName} onChange={e => setEditName(e.target.value)}
                                aria-label={t('dialog.manage.filterName')}
                                className="mb-1 w-full rounded border px-2 py-1 outline-none"
                                style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                              />
                              <input value={editUrl} onChange={e => setEditUrl(e.target.value)}
                                aria-label={t('dialog.manage.filterUrl')}
                                className="mb-1 w-full rounded border px-2 py-1 outline-none"
                                style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                              />
                              <div className="flex gap-1">
                                <button type="button" onClick={async () => {
                                  if (filterUrlValue) { await updateFilterUrl(filterUrlValue, editUrl, editName); setEditingFilter(null) }
                                }} disabled={saving === 'filter'}
                                  className="cursor-pointer rounded px-2 py-1 text-white press-effect"
                                  style={{ background: 'var(--c-accent)' }}>{t('dialog.save')}</button>
                                <button type="button" onClick={() => setEditingFilter(null)}
                                  className="cursor-pointer rounded px-2 py-1"
                                  style={{ color: 'var(--c-text-secondary)' }}>{t('dialog.cancel')}</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--c-border)' }}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={f.enabled}
                                aria-label={f.name}
                                onClick={async () => { if (filterUrlValue) await setFilterEnabled(filterUrlValue, f.name, !f.enabled) }}
                                disabled={saving === 'filter'}
                                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full transition-colors ${saving === 'filter' ? 'opacity-60' : ''}`}
                                style={{ background: f.enabled ? 'var(--c-success)' : 'var(--c-border)' }}
                              >
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-white transition-transform"
                                  style={{ transform: f.enabled ? 'translateX(14px)' : 'translateX(2px)' }} />
                              </button>
                              <span className="flex-1 truncate">{f.name}</span>
                              {f.rulesCount != null && (
                                <span className="shrink-0 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{f.rulesCount} {t('dialog.manage.rulesUnit')}</span>
                              )}
                              {!f.enabled && (
                                <span className="shrink-0 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{t('dialog.manage.disabled')}</span>
                              )}
                              <button type="button" onClick={() => {
                                if (!filterUrlValue) return
                                setEditingFilter(filterUrlValue)
                                setEditName(f.name)
                                setEditUrl(filterUrlValue)
                              }}
                                aria-label={`${f.name}: ${t('dialog.save')}`}
                                className="flex shrink-0 cursor-pointer p-1 transition-colors hover:opacity-60"
                                style={{ color: 'var(--c-text-secondary)' }}
                              >
                                <PencilSimple size={12} />
                              </button>
                              {filterUrlValue && (
                                <button type="button" onClick={() => removeFilterUrl(filterUrlValue)}
                                  aria-label={`${f.name}: ${t('dialog.close')}`}
                                  className="flex shrink-0 cursor-pointer p-1 transition-colors hover:opacity-60"
                                  style={{ color: 'var(--c-danger)' }}
                                >
                                  <Trash size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {/* Add filter URL subscription */}
                    <div className="pt-2">
                      <div className="mb-1 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{t('dialog.manage.addFilterTitle')}</div>
                      <div className="flex items-center gap-2">
                        <input
                          value={filterName}
                          onChange={e => setFilterName(e.target.value)}
                          aria-label={t('dialog.manage.filterName')}
                          placeholder={t('dialog.manage.filterName')}
                          className="w-20 rounded-lg border px-2 py-1.5 text-xs outline-none"
                          style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                        />
                        <input
                          value={filterUrl}
                          onChange={e => setFilterUrl(e.target.value)}
                          aria-label={t('dialog.manage.filterUrl')}
                          placeholder={t('dialog.manage.filterUrl')}
                          className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
                          style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!filterName || !filterUrl) return
                            await addFilterUrl(filterName, filterUrl)
                            setFilterName('')
                            setFilterUrl('')
                          }}
                          disabled={saving === 'filter' || !filterName || !filterUrl}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium press-effect transition-opacity disabled:opacity-40"
                          style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)', border: 'none' }}
                        >
                          <Plus size={12} />
                          {t('dialog.add')}
                        </button>
                      </div>
                    </div>
                  </Section>
                )}
              </div>

              {/* Right: DNS Rewrites + Maintenance */}
              <div className="space-y-5">
                <Section title={t('dialog.manage.rewrites')}>
                  {rewrites.length === 0 ? (
                    <span className="text-xs" style={{ color: 'var(--c-text-secondary)' }}>{t('dialog.manage.noRewrites')}</span>
                  ) : (
                    <div className="mb-2 space-y-1">
                      {rewrites.map(r => (
                        <div key={`${r.domain}->${r.answer}`} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--c-border)' }}>
                          <span className="flex-1 truncate font-mono">{r.domain} → {r.answer}</span>
                          <button
                            type="button"
                            onClick={() => deleteRewrite(r.domain, r.answer)}
                            aria-label={`${r.domain}: ${t('dialog.close')}`}
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
                      aria-label={t('dialog.manage.rewriteDomain')}
                      placeholder={t('dialog.manage.rewriteDomain')}
                      className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                    />
                    <input
                      value={rewriteAnswer}
                      onChange={e => setRewriteAnswer(e.target.value)}
                      aria-label={t('dialog.manage.rewriteAnswer')}
                      placeholder={t('dialog.manage.rewriteAnswer')}
                      className="w-24 rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddRewrite}
                      disabled={!rewriteDomain || !rewriteAnswer}
                      className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium press-effect transition-opacity disabled:opacity-40"
                      style={{ background: 'var(--c-accent-soft)', color: 'var(--c-accent)', border: 'none' }}
                    >
                      <Plus size={12} />
                      {t('dialog.add')}
                    </button>
                  </div>
                </Section>

                <Section title={t('dialog.manage.maintenance')}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={resetStats}
                      disabled={saving === 'reset'}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs press-effect transition-colors disabled:opacity-40"
                      style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                    >
                      <Trash size={12} />
                      {saving === 'reset' ? t('dialog.manage.resetting') : t('dialog.manage.resetStats')}
                    </button>
                    <button
                      type="button"
                      onClick={clearLog}
                      disabled={saving === 'clear'}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs press-effect transition-colors disabled:opacity-40"
                      style={{ borderColor: 'var(--c-border)', color: 'var(--c-danger)' }}
                    >
                      <Trash size={12} />
                      {saving === 'clear' ? t('dialog.manage.clearing') : t('dialog.manage.clearLog')}
                    </button>
                  </div>
                </Section>
              </div>
            </div>
          </>
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
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
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