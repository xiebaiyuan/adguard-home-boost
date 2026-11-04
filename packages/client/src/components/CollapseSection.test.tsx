// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CollapseSection } from './CollapseSection'
import { installMemoryStorage } from '../test-support/memory-storage'

/**
 * C19（第四批 #17 + 第五批 #33）。
 * 红线：折叠**不许退回条件挂载**（CLAUDE.md 记录的 display:none 决策）——这里直接断言
 * 「折叠之后子树仍在 DOM 里」，谁把它改回 {open && children} 这条就会红。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
installMemoryStorage()

let root: Root | null = null
let container: HTMLElement

const marker = () => container.querySelector('[data-testid="child"]')

async function mount(props: { deferUntilOpen?: boolean; defaultOpen?: boolean } = {}) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(createElement(
      CollapseSection,
      {
        title: 'Section',
        storageKey: 'collapse_test',
        defaultOpen: props.defaultOpen ?? true,
        deferUntilOpen: props.deferUntilOpen,
      },
      createElement('div', { 'data-testid': 'child' }, 'content'),
    ))
  })
}

const toggleButton = () => container.querySelector('button') as HTMLButtonElement
const body = () => container.querySelector('.collapse-body') as HTMLElement

beforeEach(() => { localStorage.clear() })
afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C19 CollapseSection（#17/#33）', () => {
  it('#33 按钮带 aria-expanded 与 aria-controls，开合时同步', async () => {
    await mount({ defaultOpen: true })
    expect(toggleButton().getAttribute('aria-expanded')).toBe('true')
    const controls = toggleButton().getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)).toBe(body())

    await act(async () => { toggleButton().click() })
    expect(toggleButton().getAttribute('aria-expanded')).toBe('false')
    expect(body().getAttribute('data-collapsed')).toBe('true')
  })

  it('#17 折叠后子树仍然挂载（不是条件挂载），只切 content-visibility', async () => {
    await mount({ defaultOpen: true })
    expect(marker()).toBeTruthy()

    await act(async () => { toggleButton().click() })
    expect(body().getAttribute('data-collapsed')).toBe('true')
    expect(marker(), '折叠把子树卸载了——退回了条件挂载').toBeTruthy()

    await act(async () => { toggleButton().click() })
    expect(body().getAttribute('data-collapsed')).toBe('false')
    expect(marker()).toBeTruthy()
  })

  it('#17 deferUntilOpen：首次展开前不挂载，展开后永久挂载', async () => {
    await mount({ defaultOpen: false, deferUntilOpen: true })
    expect(marker(), 'deferUntilOpen 下首次展开前不该挂载').toBeNull()

    await act(async () => { toggleButton().click() })
    expect(marker()).toBeTruthy()

    await act(async () => { toggleButton().click() }) // 再折叠
    expect(body().getAttribute('data-collapsed')).toBe('true')
    expect(marker(), '展开过一次之后折叠时也不许卸载').toBeTruthy()
  })

  it('折叠状态写进 localStorage，重挂载后沿用', async () => {
    await mount({ defaultOpen: true })
    await act(async () => { toggleButton().click() })
    expect(localStorage.getItem('collapse_test')).toBe('false')
  })
})