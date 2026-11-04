// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdguard } from './useAdguard'

/**
 * C17: useAdguard 的状态流转与动作反馈。
 * 不涉及任何轮询/退避/取消逻辑，也不涉及 useTheme。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type View = ReturnType<typeof useAdguard>
type Reply = { status?: number; body?: unknown }

let view: View | null = null
let root: Root | null = null
let container: HTMLElement
let calls: string[] = []

const state = {
  protectionEnabled: true,
  version: '0.107.52',
  statusFails: false,
  protectionPostStatus: 200,
  cacheClearStatus: 200,
}

const FILTERS = [
  { id: 1, name: 'Ad Block', enabled: true, rulesCount: 5, url: 'http://f.example/list' },
  { id: 2, name: 'Off List', enabled: false, url: 'http://f.example/off' },
]

function buildRoutes(): Record<string, (init?: { body?: string }) => Reply> {
  return {
    'GET /api/adguard/status': () => state.statusFails
      ? { status: 500, body: {} }
      : { body: { protection_enabled: state.protectionEnabled, version: state.version } },
    'GET /api/adguard/filtering/status': () => ({ body: { enabled: true, filters: FILTERS, user_rules: ['||a.example^', '||b.example^'] } }),
    'GET /api/adguard/safebrowsing/status': () => ({ body: { enabled: false } }),
    'GET /api/adguard/parental/status': () => ({ body: { enabled: true } }),
    'GET /api/adguard/safesearch/status': () => ({ body: { enabled: false, google: true } }),
    'GET /api/adguard/rewrite/list': () => ({ body: [{ domain: 'nas.local', answer: '1.2.3.4', enabled: true }] }),
    'POST /api/adguard/protection': (init) => {
      if (state.protectionPostStatus !== 200) return { status: state.protectionPostStatus, body: {} }
      const body = JSON.parse(init?.body ?? '{}') as { enabled?: boolean }
      state.protectionEnabled = body.enabled === true
      return { body: {} }
    },
    'POST /api/adguard/cache_clear': () => ({ status: state.cacheClearStatus, body: {} }),
  }
}

function installFetch() {
  const routes = buildRoutes()
  calls = []
  ;(globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async (input: unknown, init?: { method?: string; body?: string }) => {
    const method = init?.method ?? 'GET'
    const key = `${method} ${String(input)}`
    calls.push(key)
    const route = routes[key]
    if (!route) throw new Error(`未 mock 的请求: ${key}`)
    const { status = 200, body } = route(init)
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

function Probe() {
  // oxlint-disable-next-line react/globals -- 测试探针：渲染时把 hook 结果存进外部变量，等价于 renderHook 的内部做法
  view = useAdguard()
  return null
}

async function mount() {
  container = document.createElement('div')
  document.body.append(container)
  act(() => {
    root = createRoot(container)
    root.render(createElement(Probe))
  })
  await flush()
}

beforeEach(() => {
  view = null
  state.protectionEnabled = true
  state.statusFails = false
  state.protectionPostStatus = 200
  state.cacheClearStatus = 200
  installFetch()
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C17 useAdguard', () => {
  it('状态流转：挂载即 loading，6 个接口回来后 loading=false 且字段落到 status', async () => {
    container = document.createElement('div')
    document.body.append(container)
    act(() => {
      root = createRoot(container)
      root.render(createElement(Probe))
    })
    expect(view!.loading).toBe(true)
    expect(view!.status).toBeNull()

    await flush()
    expect(view!.loading).toBe(false)
    expect(view!.error).toBeNull()
    expect(view!.status?.protectionEnabled).toBe(true)
    expect(view!.status?.version).toBe('0.107.52')
    expect(view!.status?.filteringEnabled).toBe(true)
    expect(view!.status?.safebrowsingEnabled).toBe(false)
    expect(view!.status?.parentalEnabled).toBe(true)
    expect(view!.status?.filters.map(f => f.name)).toEqual(['Ad Block', 'Off List'])
    expect(view!.status?.filters[0].rulesCount).toBe(5)
    expect(view!.status?.filters[1].enabled).toBe(false)
    expect(view!.status?.userRules).toBe('||a.example^\n||b.example^')
    expect(view!.rewrites).toEqual([{ domain: 'nas.local', answer: '1.2.3.4', enabled: true }])
    expect(calls).toHaveLength(6)
  })

  it('错误态：接口失败时 loading 落回 false、error 有文案、status 保持 null', async () => {
    state.statusFails = true
    await mount()

    expect(view!.loading).toBe(false)
    expect(view!.error).toBe('API error 500')
    expect(view!.status).toBeNull()
  })

  it('动作成功：toggleProtection 之后 status 反映新值，saving 复位', async () => {
    await mount()
    await act(async () => { await view!.toggleProtection(false) })

    expect(calls).toContain('POST /api/adguard/protection')
    expect(view!.status?.protectionEnabled).toBe(false)
    expect(view!.saving).toBeNull()
    expect(view!.error).toBeNull()
  })

  it('动作失败有反馈：#14 的 actionError 拿到错误、saving 复位、乐观更新回滚', async () => {
    state.protectionPostStatus = 500
    await mount()
    expect(view!.status?.protectionEnabled).toBe(true)

    let outcome: unknown = 'pending'
    await act(async () => {
      outcome = await view!.toggleProtection(false).then(() => 'resolved', (e: unknown) => e)
    })

    // #14：hook 内统一 catch，失败进 actionError（不再只剩一条 unhandled rejection）
    expect(view!.actionError, '动作失败没有可显示的反馈').toBe('API error 500')
    expect(outcome).not.toBeInstanceOf(Error) // 已经内部消化，调用点不再需要 try/catch
    expect(view!.saving).toBeNull()
    // 乐观更新在失败后翻回去，UI 不再显示已切换的假状态
    expect(view!.status?.protectionEnabled).toBe(true)
  })

  it('无返回值的动作失败也让 saving 复位并给出 actionError（clearCache）', async () => {
    state.cacheClearStatus = 500
    await mount()

    await act(async () => { await view!.clearCache() })

    expect(view!.actionError).toBe('API error 500')
    expect(view!.saving).toBeNull()
  })

  it('#14 成功的动作会把上一次的 actionError 清掉', async () => {
    state.cacheClearStatus = 500
    await mount()
    await act(async () => { await view!.clearCache() })
    expect(view!.actionError).toBe('API error 500')

    state.cacheClearStatus = 200
    await act(async () => { await view!.clearCache() })
    expect(view!.actionError).toBeNull()
  })
})