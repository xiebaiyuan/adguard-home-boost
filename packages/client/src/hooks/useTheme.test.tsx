// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './useTheme'
import { installMemoryStorage } from '../test-support/memory-storage'

/**
 * C18（第四批 #15）：系统主题跟随。
 * 第三批故意没锁这条，这里补上：matchMedia 的 change 事件要真的推动 resolved 与 <html class="dark">。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
installMemoryStorage()

type View = ReturnType<typeof useTheme>
let view: View | null = null
let root: Root | null = null
let container: HTMLElement

/** 可控的 matchMedia：能改 matches 并分发 change */
function mockMatchMedia(initialDark: boolean) {
  let dark = initialDark
  const listeners = new Set<(ev: { matches: boolean }) => void>()
  const mql = {
    get matches() { return dark },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, fn: (ev: { matches: boolean }) => void) => { listeners.add(fn) },
    removeEventListener: (_type: string, fn: (ev: { matches: boolean }) => void) => { listeners.delete(fn) },
    addListener: (fn: (ev: { matches: boolean }) => void) => { listeners.add(fn) },
    removeListener: (fn: (ev: { matches: boolean }) => void) => { listeners.delete(fn) },
    dispatchEvent: () => true,
  }
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia
  return {
    setDark(next: boolean) {
      dark = next
      for (const fn of listeners) fn({ matches: next })
    },
    listenerCount: () => listeners.size,
  }
}

function Probe() {
  // oxlint-disable-next-line react/globals -- 测试探针：渲染时把 hook 结果存进外部变量，等价于 renderHook 的内部做法
  view = useTheme()
  return null
}

async function mount() {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(createElement(ThemeProvider, null, createElement(Probe)))
  })
}

beforeEach(() => {
  view = null
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
  vi.restoreAllMocks()
})

describe('C18 useTheme 系统主题跟随（#15）', () => {
  it('system 模式下系统切深色，resolved 与 <html class="dark"> 一起变', async () => {
    localStorage.setItem('theme', 'system')
    const mm = mockMatchMedia(false)
    await mount()

    expect(view!.theme).toBe('system')
    expect(view!.resolved).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await act(async () => { mm.setDark(true) })
    expect(view!.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await act(async () => { mm.setDark(false) })
    expect(view!.resolved).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('一开始就是系统深色时，挂载即深色', async () => {
    localStorage.setItem('theme', 'system')
    mockMatchMedia(true)
    await mount()

    expect(view!.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('手动主题不受系统变化影响；切回 system 后重新跟随系统', async () => {
    localStorage.setItem('theme', 'light')
    const mm = mockMatchMedia(true)
    await mount()

    expect(view!.resolved).toBe('light')
    await act(async () => { mm.setDark(false) })
    expect(view!.resolved).toBe('light') // 手动模式下系统变化不影响

    await act(async () => { view!.setTheme('system') })
    expect(view!.resolved).toBe('light')
    await act(async () => { mm.setDark(true) })
    expect(view!.resolved).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('切到手动主题后解除系统监听', async () => {
    localStorage.setItem('theme', 'system')
    const mm = mockMatchMedia(false)
    await mount()
    expect(mm.listenerCount()).toBe(1)

    await act(async () => { view!.setTheme('dark') })
    expect(mm.listenerCount()).toBe(0)
  })
})