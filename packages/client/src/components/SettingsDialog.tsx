import { useState } from 'react'
import { Gear, X, Trash } from '@phosphor-icons/react'

const API_BASE = ''

interface Profile {
  name: string
  url: string
  user: string
  pass: string
  timeHours: number
}

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  onConfigured: () => void
}

const TIME_OPTIONS = [
  { label: '最近 24 小时', value: 24 },
  { label: '最近 7 天', value: 168 },
  { label: '最近 30 天', value: 720 },
]

function loadProfiles(): Profile[] {
  try {
    return JSON.parse(localStorage.getItem('adgh_profiles') ?? '[]')
  } catch { return [] }
}

function saveProfiles(profiles: Profile[]) {
  localStorage.setItem('adgh_profiles', JSON.stringify(profiles))
}

export function SettingsDialog({ open, onClose, onConfigured }: SettingsDialogProps) {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles)
  const [selectedName, setSelectedName] = useState<string>('')
  const [name, setName] = useState(() => {
    const n = localStorage.getItem('adgh_profile_name')
    if (n) return n
    const url = localStorage.getItem('adgh_url') ?? ''
    return url.replace(/^https?:\/\//, '').split('/')[0] || '默认'
  })
  const [url, setUrl] = useState(() => localStorage.getItem('adgh_url') ?? '')
  const [user, setUser] = useState(() => localStorage.getItem('adgh_user') ?? '')
  const [pass, setPass] = useState(() => localStorage.getItem('adgh_pass') ?? '')
  const [timeHours, setTimeHours] = useState(() => {
    const saved = localStorage.getItem('adgh_time_hours')
    return saved ? parseInt(saved, 10) : 24
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectProfile = (p: Profile) => {
    setSelectedName(p.name)
    setName(p.name)
    setUrl(p.url)
    setUser(p.user)
    setPass(p.pass)
    setTimeHours(p.timeHours)
  }

  const handleDeleteProfile = (profileName: string) => {
    const updated = profiles.filter(p => p.name !== profileName)
    setProfiles(updated)
    saveProfiles(updated)
    if (selectedName === profileName) setSelectedName('')
  }

  const handleSave = async () => {
    if (!url || !user || !pass) {
      setError('请填写所有字段')
      return
    }
    if (!name.trim()) {
      setError('请输入配置名称')
      return
    }

    setSaving(true)
    setError(null)

    let normalizedUrl = url.trim()
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `http://${normalizedUrl}`
    }

    try {
      const res = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          adguardConfig: {
            baseUrl: normalizedUrl.replace(/\/$/, ''),
            username: user,
            password: pass,
            rejectUnauthorized: false,
            timeRangeHours: timeHours,
          },
        }),
      })

      if (!res.ok) throw new Error(`配置失败: ${res.status}`)

      // Save to localStorage
      localStorage.setItem('adgh_url', url)
      localStorage.setItem('adgh_user', user)
      localStorage.setItem('adgh_pass', pass)
      localStorage.setItem('adgh_time_hours', String(timeHours))
      localStorage.setItem('adgh_profile_name', name.trim())

      // Save/update profile list
      const newProfile: Profile = {
        name: name.trim(),
        url,
        user,
        pass,
        timeHours,
      }
      const updated = [...profiles.filter(p => p.name !== newProfile.name), newProfile]
      setProfiles(updated)
      saveProfiles(updated)

      onConfigured()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

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
          {/* Profile selector */}
          {profiles.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                已有配置
              </label>
              <div className="space-y-1">
                {profiles.map(p => (
                  <div key={p.name}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: selectedName === p.name ? 'var(--c-accent)' : 'var(--c-border)',
                      background: selectedName === p.name ? 'var(--c-accent-soft)' : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => handleSelectProfile(p)}
                      className="flex-1 cursor-pointer text-left outline-none"
                      style={{ color: 'var(--c-text)' }}
                    >
                      <span className="text-xs font-medium">{p.name}</span>
                      <span className="ml-2 text-[11px]" style={{ color: 'var(--c-text-secondary)' }}>{p.url}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(p.name)}
                      className="flex shrink-0 cursor-pointer items-center p-1 transition-colors hover:opacity-60"
                      style={{ color: 'var(--c-text-secondary)' }}
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              配置名称
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：路由器、办公室"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              AdGuardHome 地址
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="http://192.168.8.88"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              用户名
            </label>
            <input
              value={user}
              onChange={e => setUser(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
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
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--c-text-secondary)' }}>
              分析时间范围
            </label>
            <select
              value={timeHours}
              onChange={e => setTimeHours(parseInt(e.target.value, 10))}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)' }}
            >
              {TIME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
