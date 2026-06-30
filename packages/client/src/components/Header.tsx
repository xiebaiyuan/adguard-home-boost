import { useTheme } from '../hooks/useTheme'
import { Sun, Moon } from '@phosphor-icons/react'

export function Header() {
  const { resolved, setTheme } = useTheme()

  return (
    <header className="glass-card sticky top-0 z-10 border-b-0">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--c-accent-soft)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold gradient-text">
              DNS 延时分析
            </span>
            <span className="ml-2 text-xs" style={{ color: 'var(--c-text-secondary)' }}>
              AdGuardHome
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--c-text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-accent-soft)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title={`切换到${resolved === 'dark' ? '浅色' : '深色'}模式`}
          >
            {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  )
}
