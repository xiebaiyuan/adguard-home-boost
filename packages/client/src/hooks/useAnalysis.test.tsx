// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnalysis, type DashboardPayload } from './useAnalysis'
import { installMemoryStorage } from '../test-support/memory-storage'

/**
 * C17: useAnalysis 的初始加载、错误态，以及 ready / lastError 的消费路径。
 *
 * 有意不覆盖的部分（留给第四批，写进来会被改红）：
 * - 轮询的退避节奏与取消机制（这里只用真实计时器等到状态落地，不断言等待时长与次数上限）；
 * - useTheme 的系统主题跟随。
 *
 * 不用假计时器：hook 内部的等待是 setTimeout，第四批会重写这段；用真实计时器 + waitFor
 * 只等结果，不改时间，测试对实现方式保持中立。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// Node 26 + jsdom 下 globalThis.localStorage 不可用，见 test-support/memory-storage.ts
installMemoryStorage()

type View = ReturnType<typeof useAnalysis>
type Reply = { status?: number; body?: unknown }

let view: View | null = null
let root: Root | null = null
let container: HTMLElement
let calls: string[] = []
// 用可变容器：路由在每次请求时才读，测试里换掉数组也能生效
const queues: { dashboard: Reply[]; summary: Reply[] } = { dashboard: [], summary: [] }

const FRESH = () => new Date().toISOString()
const STALE = () => new Date(0).toISOString()

function payload(over: Partial<DashboardPayload> = {}): DashboardPayload {
  return {
    ready: true,
    timeRange: null,
    lastUpdated: null,
    lastError: null,
    adguardUrl: null,
    domainCount: 0,
    aggregate: { totalCount: 0, totalCached: 0, overallCacheRate: 0, overallUncached: null, overallAll: null },
    queryTypeDistribution: [],
    domains: [],
    ...over,
  }
}

function installFetch() {
  calls = []
  const next = (pick: () => Reply[], fallback: Reply) => () => {
    const queue = pick()
    return queue.length ? queue.shift()! : fallback
  }
  const routes: Record<string, () => Reply> = {
    'GET /api/analysis/dashboard': next(() => queues.dashboard, { body: payload() }),
    'GET /api/analysis/summary': next(() => queues.summary, { body: { ready: true, lastUpdated: FRESH(), lastError: null } }),
    'POST /api/config': () => ({ body: { message: 'configuration updated' } }),
    'POST /api/analysis/refresh': () => ({ body: { message: 'refresh started' } }),
  }
  ;(globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (input: unknown, init?: { method?: string }) => {
    const method = init?.method ?? 'GET'
    const key = `${method} ${String(input)}`
    calls.push(key)
    const route = routes[key]
    if (!route) throw new Error(`未 mock 的请求: ${key}`)
    const { status = 200, body } = route()
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as unknown as Response
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function flush() {
  await act(async () => { await sleep(0) })
}

/** 等 hook 里的异步链把状态推到预期，全程在 act 里推，避免 act 警告 */
async function waitFor(check: () => boolean, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return
    await act(async () => { await sleep(50) })
  }
  throw new Error(`waitFor 超时：${JSON.stringify({ loading: view?.loading, error: view?.error, data: view?.data?.ready })}`)
}

function Probe() {
  // oxlint-disable-next-line react/globals -- 测试探针：渲染时把 useAnalysis 的结果存进外部变量，等价于 renderHook 的内部做法
  view = useAnalysis()
  return null
}

async function mount() {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root!.render(createElement(Probe)) })
  await flush()
}

beforeEach(() => {
  view = null
  localStorage.clear()
  queues.dashboard = []
  queues.summary = []
  installFetch()
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C17 useAnalysis', () => {
  it('初始加载：没有本地配置时只拉 dashboard + summary，不发起刷新', async () => {
    queues.dashboard = [{ body: payload({ ready: true, adguardUrl: 'http://adgh.local' }) }]
    await mount()

    expect(view!.loading).toBe(false)
    expect(view!.error).toBeNull()
    expect(view!.data?.ready).toBe(true)
    expect(view!.data?.adguardUrl).toBe('http://adgh.local')
    expect(calls).toEqual(['GET /api/analysis/dashboard', 'GET /api/analysis/summary'])
    expect(calls.some(c => c.startsWith('POST'))).toBe(false)
  })

  it('错误态：dashboard 非 2xx 时给出错误，data 保持 null', async () => {
    queues.dashboard = [{ status: 500 }]
    await mount()

    expect(view!.loading).toBe(false)
    expect(view!.data).toBeNull()
    expect(view!.error).toBe('API error: 500')
  })

  it('消费 dashboard 里的 lastError：即使响应是 200 也要显示后端记录的错误', async () => {
    queues.dashboard = [{ body: payload({ lastError: '后端记录的错误' }) }]
    await mount()

    expect(view!.error).toBe('后端记录的错误')
    expect(view!.loading).toBe(false)
    expect(view!.data?.lastError).toBe('后端记录的错误')
  })

  it('消费 ready：本地有配置且缓存过期时自动刷新，轮询到 ready 后落到 data', async () => {
    localStorage.setItem('adgh_url', 'http://adgh.local')
    localStorage.setItem('adgh_user', 'u')
    localStorage.setItem('adgh_pass', 'p')
    localStorage.setItem('adgh_time_hours', '24')
    queues.dashboard = [
      { body: payload({ ready: false }) },
      { body: payload({ ready: true, adguardUrl: 'http://adgh.local', domains: [payload().domains[0]].slice(0, 0) }) },
    ]
    queues.summary = [
      { body: { ready: false, lastUpdated: STALE(), lastError: null } }, // init 检查新鲜度：过期
      { body: { ready: true, lastUpdated: FRESH(), lastError: null } },  // 第一次轮询就 ready
    ]

    await mount()
    await waitFor(() => view!.data?.ready === true && view!.loading === false)

    expect(view!.error).toBeNull()
    expect(view!.data?.adguardUrl).toBe('http://adgh.local')
    expect(calls).toContain('POST /api/config')
    expect(calls).toContain('POST /api/analysis/refresh')
    expect(calls.filter(c => c === 'GET /api/analysis/dashboard')).toHaveLength(2)
  })

  it('消费 lastError：手动 refresh 的轮询拿到 lastError 就停并显示，refreshing 复位', async () => {
    await mount()
    expect(view!.error).toBeNull()

    calls = []
    queues.summary = [{ body: { ready: false, lastUpdated: null, lastError: '刷新期间配置被改了，这一轮结果已丢弃，请重新刷新' } }]
    await act(async () => { await view!.refresh() })

    expect(calls).toContain('POST /api/analysis/refresh')
    expect(view!.error).toBe('刷新期间配置被改了，这一轮结果已丢弃，请重新刷新')
    expect(view!.refreshing).toBe(false)
  })
})