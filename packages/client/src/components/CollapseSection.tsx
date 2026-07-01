import { useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'

export function CollapseSection({ title, storageKey, defaultOpen, children, badge }: {
  title: string
  storageKey: string
  defaultOpen?: boolean
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    return stored !== null ? stored === 'true' : (defaultOpen ?? true)
  })

  const toggle = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem(storageKey, String(next))
  }

  return (
    <div className="mb-6">
      <button
        onClick={toggle}
        className="mb-3 flex w-full cursor-pointer items-center gap-2 text-left outline-none"
      >
        <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{title}</span>
        {badge}
        <span className="ml-auto" style={{ color: 'var(--c-text-secondary)' }}>
          {open ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </span>
      </button>
      {open && children}
    </div>
  )
}
