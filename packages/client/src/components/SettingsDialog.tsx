import { useState } from 'react'
import { Gear, X } from '@phosphor-icons/react'

const API_BASE = ''

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  onConfigured: () => void
}

export function SettingsDialog({ open, onClose, onConfigured }: SettingsDialogProps) {
  const [url, setUrl] = useState(() => localStorage.getItem('adgh_url') ?? '')
  const [user, setUser] = useState(() => localStorage.getItem('adgh_user') ?? '')
  const [pass, setPass] = useState(() => localStorage.getItem('adgh_pass') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSave = async () => {
    if (!url || !user || !pass) {
      setError('请填写所有字段')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adguardConfig: {
            baseUrl: url.replace(/\/$/, ''),
            username: user,
            password: pass,
            rejectUnauthorized: false,
          },
        }),
      })

      if (!res.ok) throw new Error(`配置失败: ${res.status}`)

      // Save to localStorage for convenience
      localStorage.setItem('adgh_url', url)
      localStorage.setItem('adgh_user', user)
      localStorage.setItem('adgh_pass', pass)

      onConfigured()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'oklch(0 0 0 / 0.4)' }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-sm rounded-2xl p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gear size={16} style={{ color: 'var(--c-accent)' }} />
            <span className="text-sm font-medium">AdGuardHome 配置</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition-colors hover:opacity-60"
            style={{ color: 'var(--c-text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              AdGuardHome 地址
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://adguard.192.168.8.97.nip.io"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              style={{
                borderColor: 'var(--c-border)',
                background: 'var(--c-bg)',
                color: 'var(--c-text)',
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              用户名
            </label>
            <input
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder="admin"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--c-border)',
                background: 'var(--c-bg)',
                color: 'var(--c-text)',
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              密码
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                borderColor: 'var(--c-border)',
                background: 'var(--c-bg)',
                color: 'var(--c-text)',
              }}
            />
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'oklch(0.58 0.22 27 / 0.1)', color: 'var(--c-danger)' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full cursor-pointer rounded-lg py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'var(--c-accent-gradient)', border: 'none' }}
          >
            {saving ? '保存中...' : '保存并连接'}
          </button>
        </div>
      </div>
    </div>
  )
}
