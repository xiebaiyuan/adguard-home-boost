import { afterEach, describe, expect, it } from 'vitest'
import { installMemoryStorage } from './memory-storage'

/**
 * C17 辅助：内存版 localStorage 的两条分支。
 * node 环境，不需要 jsdom。
 */
function removeGlobalStorage() {
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true })
}

afterEach(() => {
  removeGlobalStorage()
})

describe('C17 installMemoryStorage', () => {
  it('没有可用实现时装一个能读写的 Storage', () => {
    removeGlobalStorage()
    const storage = installMemoryStorage()
    expect(typeof storage.getItem).toBe('function')

    expect(storage.getItem('missing')).toBeNull()
    storage.setItem('a', '1.2.3.4')
    storage.setItem('b', '2')
    expect(storage.getItem('a')).toBe('1.2.3.4')
    expect(storage.length).toBe(2)
    expect(storage.key(0)).toBe('a')
    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    expect(storage.length).toBe(1)
    storage.clear()
    expect(storage.length).toBe(0)
    expect(storage.key(0)).toBeNull()

    expect(installMemoryStorage()).toBe(storage) // 幂等：第二次仍返回同一个
  })

  it('已经有一个可用的实现时直接复用，不替换', () => {
    const original = { getItem: () => 'x' } as unknown as Storage
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true, writable: true })
    expect(installMemoryStorage()).toBe(original)
  })
})