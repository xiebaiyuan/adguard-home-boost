// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { Dashboard } from './Dashboard'
import { installMemoryStorage } from '../test-support/memory-storage'
import type { DashboardPayload } from 'shared'

/**
 * C19（#13）：首屏 /api/adguard/* 请求数。
 * 改前：Dashboard 与 ManagementDialog 各持一份 useAdguard → 6 个接口各打两遍 = 12。
 * 改后：只有 Dashboard 那一份 → 6。这里直接数请求，不靠肉眼看代码。
 *
 * 为了让这个用例只测「请求数」，把统计面板与三个折叠区块都设成关闭态：
 * StatsPanel 与 recharts 就不挂载，避免把图表渲染拖进来。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
installMemoryStorage()

let root: Root | null = null
let container: HTMLElement
let calls: string[] = []

const payload = (): DashboardPayload => ({
  ready: true,
  timeRange: null,
  lastUpdated: null,
  lastError: null,
  adguardUrl: 'http://adgh.local',
  domainCount: 0,
  aggregate: { totalCount: 0, totalCached: 0, overallCacheRate: 0, overallUncached: null, overallAll: null },
  queryTypeDistribution: [],
  domains: [],
})

const ADGUARD_ROUTES: Record<string, unknown> = {
  '/api/adguard/status': { protection_enabled: true, version: '0.107.52' },
  '/api/adguard/filtering/status': { enabled: true, filters: [], user_rules: [] },
  '/api/adguard/safebrowsing/status': { enabled: false },
  '/api/adguard/parental/status': { enabled: false },
  '/api/adguard/safesearch/status': { enabled: false },
  '/api/adguard/rewrite/list': [],
}

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
  // 只保留工具栏与 KPI：统计面板与三个折叠区块都关掉
  localStorage.setItem('panel_stats', 'false')
  localStorage.setItem('collapse_stats', 'false')
  localStorage.setItem('collapse_latency', 'false')
  localStorage.setItem('collapse_domains', 'false')
  calls = []
  ;(globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (input: unknown) => {
    const url = String(input)
    calls.push(url)
    if (url === '/api/analysis/dashboard') return json(payload())
    if (url === '/api/analysis/summary') return json({ ready: true, lastUpdated: new Date().toISOString(), lastError: null, domainCount: 0, adguardUrl: 'http://adgh.local' })
    if (url.startsWith('/api/adguard/')) return json(ADGUARD_ROUTES[url] ?? {})
    return json({})
  })
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C19 首屏 /api/adguard/* 请求数（#13）', () => {
  it('只打 6 个 AdGuardHome 接口，不是 12 个', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(createElement(I18nProvider, null, createElement(Dashboard)))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    const adguardCalls = calls.filter(c => c.startsWith('/api/adguard/'))
    expect(adguardCalls, `实际打了 ${adguardCalls.length} 次：${adguardCalls.join(', ')}`).toHaveLength(6)
    expect([...adguardCalls].sort()).toEqual([
      '/api/adguard/filtering/status',
      '/api/adguard/parental/status',
      '/api/adguard/rewrite/list',
      '/api/adguard/safebrowsing/status',
      '/api/adguard/safesearch/status',
      '/api/adguard/status',
    ])
    // 主数据链各一次
    expect(calls.filter(c => c === '/api/analysis/dashboard')).toHaveLength(1)
    expect(calls.filter(c => c === '/api/analysis/summary')).toHaveLength(1)
  })

  it('打开管理对话框不会再补一轮请求', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root!.render(createElement(I18nProvider, null, createElement(Dashboard)))
    })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    const before = calls.filter(c => c.startsWith('/api/adguard/')).length

    const manageBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'AdGuardHome Management')
    expect(manageBtn, '找不到打开管理的按钮').toBeTruthy()
    await act(async () => { manageBtn!.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })

    expect(calls.filter(c => c.startsWith('/api/adguard/')).length).toBe(before)
  })
})