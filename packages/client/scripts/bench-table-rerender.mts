// 性能基准：DomainTable 500 行场景下，每次搜索键入引发的 re-render 耗时。
// 运行：npx tsx scripts/bench-table-rerender.mts
// 基线（2026-07，M 系列 Mac）：
//   优化前（无 memo、内联闭包）  中位 ~60ms/键入 —— INP 边界
//   优化后（memo + useDeferredValue）中位 ~3ms/键入
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true })
;(globalThis as any).window = dom.window
;(globalThis as any).document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
;(globalThis as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

import React from 'react'
;(globalThis as any).React = React

async function main() {
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const { DomainTable } = await import('../src/components/DomainTable.tsx')

  const mk = (i: number) => ({
    domain: 'domain-' + i + '.example.com',
    totalCount: i * 3 + 1,
    cachedCount: i,
    cacheHitRate: 0.5 + (i % 50) / 100,
    queryTypes: { A: 10, AAAA: i % 5, HTTPS: i % 3 },
    uncached: { count: 10, min: 1, max: 900, avg: 100, p20: 10, p50: 50, p60: 60, p70: 70, p80: 80, p95: 300 + i, p99: 800, slowRate: 0.1, severeRate: 0.01 },
    all: { count: 12, min: 0, max: 900, avg: 80, p20: 8, p50: 40, p60: 50, p70: 60, p80: 70, p95: 280, p99: 780, slowRate: 0.08, severeRate: 0.01 },
  })
  const domains = Array.from({ length: 500 }, (_, i) => mk(i))

  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)

  await act(async () => {
    root.render(React.createElement(DomainTable, { domains }))
  })

  const input = container.querySelector('input[type="text"]') as HTMLInputElement
  if (!input) throw new Error('search input not found')

  const typeChar = async (value: string) => {
    const t0 = performance.now()
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!
      nativeSetter.call(input, value)
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    })
    return performance.now() - t0
  }

  // 预热
  await typeChar('x')
  await typeChar('')

  // 依次键入 d, do, dom...（保持大量行匹配，维持 500 行渲染压力）
  const seq = ['d', 'do', 'dom', 'doma', 'domai', 'domain', 'domain-', 'domain-1']
  const times: number[] = []
  for (const s of seq) {
    times.push(await typeChar(s))
  }
  times.sort((a, b) => a - b)
  console.log('per-keystroke re-render times(ms):', times.map(t => t.toFixed(1)).join(', '))
  console.log('median:', times[Math.floor(times.length / 2)].toFixed(1), 'ms')

  root.unmount()
}
main()
