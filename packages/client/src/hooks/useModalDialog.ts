import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * #33 对话框的可访问性：打开时把焦点移进面板、Tab 在面板内循环、Esc 关闭、关闭后把焦点还给原来的元素。
 * 只用原生 DOM API，没有引入任何依赖。
 */
export function useModalDialog({ open, onClose }: { open: boolean; onClose: () => void }): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null)
  // onClose 往往是父组件里的内联箭头函数，放进 ref 里，避免每次父渲染都重跑这个副作用把焦点抢走
  const onCloseRef = useRef(onClose)
  // 在 effect 里同步最新回调（render 期写 ref 会被 react(refs) 规则拦）
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const previous = document.activeElement as HTMLElement | null

    const focusables = (): HTMLElement[] => {
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.tabIndex >= 0)
    }

    focusables()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = focusables()
      if (nodes.length === 0) return
      const head = nodes[0]
      const tail = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault()
        head.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [open])

  return panelRef
}