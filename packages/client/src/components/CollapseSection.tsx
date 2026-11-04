import { useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'

/**
 * 可折叠区块。
 *
 * #17 这里**保留挂载语义**：折叠只切换展示，不卸载 children。
 * `display:none` 是 CLAUDE.md 记录的既定决策（避免卸载重挂的卡顿），本轮没有改回条件挂载，
 * 只把折叠态换成 `content-visibility: hidden`（见 index.css 的 .collapse-body）：
 * 浏览器跳过子树的样式/布局/绘制，DOM 与组件状态都还在，展开即时无抖。
 *
 * 说明边界：content-visibility 省的是浏览器侧成本；React 仍会渲染已挂载的 children。
 * 那部分由 #16 的分批渲染压（表格默认只渲染 100 行，而不是 500 行）。
 *
 * deferUntilOpen：给 recharts 这类懒加载区块用——首次展开前不挂载，避免首屏就下载 chunk；
 * 一旦展开过就永久挂载，之后再折叠也**不会卸载**（不回到条件挂载的卡顿）。
 */
export function CollapseSection({ title, storageKey, defaultOpen, children, badge, deferUntilOpen }: {
  title: string
  storageKey: string
  defaultOpen?: boolean
  children?: React.ReactNode
  badge?: React.ReactNode
  deferUntilOpen?: boolean
}) {
  const [open, setOpen] = useState(() => {
    const stored = localStorage.getItem(storageKey)
    return stored !== null ? stored === 'true' : (defaultOpen ?? true)
  })
  const [everOpened, setEverOpened] = useState(open)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !everOpened) setEverOpened(true)
    localStorage.setItem(storageKey, String(next))
  }

  const bodyId = `collapse-body-${storageKey}`
  const mounted = !deferUntilOpen || everOpened

  return (
    <div className="mb-6">
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="mb-3 flex w-full cursor-pointer items-center gap-2 text-left outline-none press-effect-soft rounded-lg px-1 -ml-1"
        style={{ textWrap: 'balance' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{title}</span>
        {badge}
        <span className="ml-auto" style={{ color: 'var(--c-text-secondary)' }}>
          {open ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </span>
      </button>
      <div id={bodyId} className="collapse-body" data-collapsed={open ? 'false' : 'true'}>
        {mounted ? children : null}
      </div>
    </div>
  )
}