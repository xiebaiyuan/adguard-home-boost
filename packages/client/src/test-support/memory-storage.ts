/**
 * 测试专用的 localStorage 兜底实现。
 *
 * 为什么需要：本机 Node 26 自带一个 `globalThis.localStorage` 占位（未提供 `--localstorage-file`
 * 时取到的是 undefined），而 vitest 的 jsdom 环境只往 globalThis 补「没有冲突」的键，
 * 于是 `window.localStorage`/`globalThis.localStorage` 在测试里都取不到可用的实现，
 * 直接调用 `localStorage.getItem(...)` 会抛 TypeError。这里按 Storage 的形状装一个内存实现，
 * 让依赖 localStorage 的 hook 在测试里能真实跑起来。只给测试用，应用代码不引用本模块。
 */
export function installMemoryStorage(): Storage {
  const existing = (globalThis as { localStorage?: Storage }).localStorage
  if (existing && typeof existing.getItem === 'function') return existing

  const storage = createMemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  return storage
}

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      const k = String(key)
      return map.has(k) ? map.get(k)! : null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(String(key))
    },
    setItem(key: string, value: string) {
      map.set(String(key), String(value))
    },
  }
}