// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { SettingsDialog } from './SettingsDialog'
import { ManagementDialog } from './ManagementDialog'
import { installMemoryStorage } from '../test-support/memory-storage'
import type { AdguardApi } from '../hooks/useAdguard'

/**
 * C19：两个对话框的可访问性（#33）、i18n 完整度（#18）、以及 #13「对话框不再自带一份 hook」。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
installMemoryStorage()

let root: Root | null = null
let container: HTMLElement
let fetchSpy: ReturnType<typeof vi.fn>

// runAction 包装的动作返回 Promise<boolean>，refresh / toggleProtection 返回 Promise<void>，桩按各自签名写
const ok = async (..._args: unknown[]) => true
const voidAction = async () => {}
const stubAdguard = (over: Partial<AdguardApi> = {}): AdguardApi => ({
  status: {
    protectionEnabled: true,
    version: '1.2.3',
    filteringEnabled: true,
    safebrowsingEnabled: false,
    parentalEnabled: true,
    safesearch: { enabled: false },
    filters: [{ name: 'Ad Block', enabled: true, rulesCount: 3, url: 'http://f.example/list' }],
    rewrites: [{ domain: 'nas.local', answer: '1.2.3.4', enabled: true }],
    userRules: '||ads.example^',
  },
  loading: false,
  error: null,
  saving: null,
  actionError: null,
  rewrites: [{ domain: 'nas.local', answer: '1.2.3.4', enabled: true }],
  refresh: voidAction,
  toggleProtection: voidAction,
  clearCache: ok,
  toggleSafebrowsing: ok,
  toggleParental: ok,
  setUserRules: ok,
  addRewrite: ok,
  deleteRewrite: ok,
  addFilterUrl: ok,
  removeFilterUrl: ok,
  setFilterEnabled: ok,
  updateFilterUrl: ok,
  resetStats: ok,
  clearLog: ok,
  ...over,
})

async function mount(node: React.ReactElement) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root!.render(createElement(I18nProvider, null, node)) })
}

const panel = () => document.querySelector('[role="dialog"]') as HTMLElement | null

async function pressEscape() {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
  fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' }) as unknown as Response)
  ;(globalThis as unknown as { fetch: unknown }).fetch = fetchSpy
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C19 对话框可访问性与 i18n', () => {
  it('SettingsDialog：role=dialog + aria-modal + aria-labelledby，Esc 关闭，焦点在面板内', async () => {
    const onClose = vi.fn()
    await mount(createElement(SettingsDialog, { open: true, onClose, onConfigured: vi.fn() }))

    const p = panel()
    expect(p).toBeTruthy()
    expect(p!.getAttribute('aria-modal')).toBe('true')
    const labelledBy = p!.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy!)?.textContent).toBe('AdGuardHome Configuration')
    expect(p!.contains(document.activeElement), '打开后焦点没有移进面板').toBe(true)

    await pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('SettingsDialog：英文模式下面板里没有残留中文（#18）', async () => {
    await mount(createElement(SettingsDialog, { open: true, onClose: vi.fn(), onConfigured: vi.fn() }))
    expect(panel()!.textContent ?? '').not.toMatch(/[\u4e00-\u9fa5]/)
  })

  it('ManagementDialog：#13 自己不发请求（hook 由 Dashboard 持有）', async () => {
    await mount(createElement(ManagementDialog, {
      open: true,
      onClose: vi.fn(),
      adguard: stubAdguard(),
    }))

    expect(fetchSpy, '对话框自己调了接口，说明还带着第二份 useAdguard').not.toHaveBeenCalled()
  })

  it('ManagementDialog：role/aria-modal/Esc 与英文文案齐备（#18/#33）', async () => {
    const onClose = vi.fn()
    await mount(createElement(ManagementDialog, { open: true, onClose, adguard: stubAdguard() }))

    const p = panel()!
    expect(p.getAttribute('aria-modal')).toBe('true')
    expect(document.getElementById(p.getAttribute('aria-labelledby')!)?.textContent).toBe('AdGuardHome Management')
    expect(p.textContent).toContain('Safe Browsing')
    expect(p.textContent).toContain('DNS Rewrites')
    expect(p.textContent ?? '').not.toMatch(/[\u4e00-\u9fa5]/)

    await pressEscape()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ManagementDialog：动作失败的 actionError 会在面板里显示出来（#14 的消费端）', async () => {
    await mount(createElement(ManagementDialog, {
      open: true,
      onClose: vi.fn(),
      adguard: stubAdguard({ actionError: 'API error 500' }),
    }))

    const alert = panel()!.querySelector('[role="alert"]')
    expect(alert, '动作错误没有渲染').toBeTruthy()
    expect(alert!.textContent).toBe('API error 500')
  })
})