// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { I18nProvider } from '../lib/i18n'
import { DomainTable, ROWS_PER_PAGE } from './DomainTable'
import { installMemoryStorage } from '../test-support/memory-storage'
import type { DomainStats } from 'shared'

/**
 * C19（第四批 #16 + 第五批 #33）：域名表分批渲染与表头可访问性。
 * 注意：jsdom 只证明「DOM 里有多少行」，浏览器真实渲染成本未实测。
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
installMemoryStorage()

let root: Root | null = null
let container: HTMLElement

const LAT = (p95: number) => ({
  count: 10, min: 1, max: p95, avg: p95 / 2, p20: 1, p50: 2, p60: 3, p70: 4, p80: 5, p95, p99: p95,
  slowRate: 0, severeRate: 0,
})

function fixture(n: number): DomainStats[] {
  return Array.from({ length: n }, (_, i) => ({
    domain: `d${i}.example.com`,
    totalCount: i + 1,
    cachedCount: 0,
    cacheHitRate: 0.5,
    queryTypes: { A: i + 1 },
    uncached: LAT(100 + i),
    topClients: [],
    blockedCount: 0,
    blockedRate: 0,
    topBlockRules: [],
  }))
}

async function mount(domains: DomainStats[]) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(createElement(I18nProvider, null, createElement(DomainTable, { domains })))
  })
}

const bodyRows = () => container.querySelectorAll('tbody tr.table-row-hover').length
const sortHeader = (label: string) =>
  Array.from(container.querySelectorAll('th')).find(th => th.textContent?.startsWith(label)) ?? null

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
})

afterEach(async () => {
  if (root) await act(async () => { root!.unmount() })
  root = null
  container?.remove()
})

describe('C19 DomainTable 分批渲染（#16）', () => {
  it('500 行只渲染首批 100 行，并给出「加载更多」', async () => {
    await mount(fixture(500))

    expect(bodyRows()).toBe(ROWS_PER_PAGE)
    const more = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Load more'))
    expect(more, '没有「加载更多」按钮').toBeTruthy()
    expect(more!.textContent).toContain(`100/500`)
    expect(container.querySelectorAll('tbody tr.table-row-hover').length).toBeLessThan(500)
  })

  it('点一次「加载更多」多渲染一批，直到全部显示后按钮消失', async () => {
    await mount(fixture(ROWS_PER_PAGE + 30))
    expect(bodyRows()).toBe(ROWS_PER_PAGE)

    await act(async () => {
      const more = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Load more'))
      more!.click()
    })
    expect(bodyRows()).toBe(ROWS_PER_PAGE + 30)
    expect(Array.from(container.querySelectorAll('button')).some(b => b.textContent?.includes('Load more'))).toBe(false)
  })

  it('数据少于一批时不出现「加载更多」', async () => {
    await mount(fixture(12))
    expect(bodyRows()).toBe(12)
    expect(container.textContent).not.toContain('Load more')
  })
})

describe('C19 DomainTable 表头可访问性（#33）', () => {
  it('默认按 P95 降序：该列表头 aria-sort=descending，其余为 none', async () => {
    await mount(fixture(5))
    expect(sortHeader('P95')?.getAttribute('aria-sort')).toBe('descending')
    expect(sortHeader('P50')?.getAttribute('aria-sort')).toBe('none')
  })

  it('表头排序是键盘可达的按钮，点一次翻转 aria-sort 方向', async () => {
    await mount(fixture(5))
    const th = sortHeader('P95')!
    const button = th.querySelector('button')
    expect(button, '表头里没有可聚焦按钮').toBeTruthy()
    expect(button!.tagName).toBe('BUTTON')

    await act(async () => { button!.click() })
    expect(sortHeader('P95')?.getAttribute('aria-sort')).toBe('ascending')

    // 换一列排序：新列 descending，旧列回到 none
    const countButton = sortHeader('Count')!.querySelector('button')!
    await act(async () => { countButton.click() })
    expect(sortHeader('Count')?.getAttribute('aria-sort')).toBe('descending')
    expect(sortHeader('P95')?.getAttribute('aria-sort')).toBe('none')
  })

  it('搜索框与类型下拉都有可访问名称', async () => {
    await mount(fixture(3))
    const search = container.querySelector('input[type="text"]')!
    expect(search.getAttribute('aria-label')).toBe('Search domains...')
    const select = container.querySelector('select')!
    expect(select.getAttribute('aria-label')).toBe('All Types')
  })
})