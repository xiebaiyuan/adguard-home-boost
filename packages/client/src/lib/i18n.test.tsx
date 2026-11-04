// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider, useI18n } from './i18n'
import { installMemoryStorage } from '../test-support/memory-storage'

/**
 * C17: i18n 运行时行为。
 * 只覆盖不会跟第四批冲突的部分：真实文案能取到、语言切换生效、未知 key 会回落。
 * 不涉及 useTheme 的系统主题跟随，也不涉及任何轮询逻辑。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// Node 26 + jsdom 下 globalThis.localStorage 不可用，见 test-support/memory-storage.ts
installMemoryStorage()

type Ctx = ReturnType<typeof useI18n>
let ctx: Ctx | null = null
let root: Root | null = null
let container: HTMLElement

function Probe() {
  // oxlint-disable-next-line react/globals -- 测试探针：渲染时把 useI18n 的结果存进外部变量，等价于 renderHook 的内部做法
  ctx = useI18n()
  return null
}

async function mount() {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root!.render(createElement(I18nProvider, null, createElement(Probe))) })
}

beforeEach(() => {
  ctx = null
  localStorage.clear()
  document.documentElement.lang = ''
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C17 i18n 运行时', () => {
  it('t() 取到的是真实文案，而不是 key 本身', async () => {
    await mount()
    expect(ctx!.t('app.title')).toBe('AdGuard Home Boost')
    expect(ctx!.t('header.lang')).not.toBe('header.lang')
    expect(['English', '中文']).toContain(ctx!.t('header.lang'))
  })

  it('切到 zh：文案、documentElement.lang、localStorage 一起变', async () => {
    await mount()
    await act(async () => { ctx!.setLang('zh') })
    expect(ctx!.lang).toBe('zh')
    expect(ctx!.t('header.lang')).toBe('English')
    expect(ctx!.t('status.ready')).toBe('Ready')
    expect(document.documentElement.lang).toBe('zh-CN')
    expect(localStorage.getItem('lang')).toBe('zh')
  })

  it('切到 en：中英两侧都能命中', async () => {
    await mount()
    await act(async () => { ctx!.setLang('zh') })
    await act(async () => { ctx!.setLang('en') })
    expect(ctx!.lang).toBe('en')
    expect(ctx!.t('header.lang')).toBe('中文')
    expect(ctx!.t('btn.refresh')).toBe('Refresh analysis data')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('lang')).toBe('en')
  })

  it('已存的 lang 偏好优先于浏览器语言', async () => {
    localStorage.setItem('lang', 'zh')
    await mount()
    expect(ctx!.lang).toBe('zh')
    expect(ctx!.t('header.lang')).toBe('English')
  })

  it('未定义的 key 回落成 key 字符串（这正是 keys 用例要防的静默回落）', async () => {
    await mount()
    expect(ctx!.t('no.such.key')).toBe('no.such.key')
    expect(ctx!.t('status.ready')).toBe('Ready')
  })
})