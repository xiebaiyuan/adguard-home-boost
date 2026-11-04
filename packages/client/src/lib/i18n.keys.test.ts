import { readFileSync, readdirSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * C17: i18n 的静态不变量。
 * 1) zh 与 en 两份字典的 key 集合一一对应；
 * 2) 代码里真正被 t(...) 引用的 key 必须都在字典里定义——否则 t() 会静默回落成 key 字符串。
 * 这里直接读源码做检查，因为两份字典没有导出，而且需要扫全站调用点。
 */

const SRC_DIR = fileURLToPath(new URL('..', import.meta.url)) // src/lib/.. -> src
const I18N_FILE = join(SRC_DIR, 'lib', 'i18n.tsx')

/**
 * key 的形状：至少一段点号路径（app.title、header.theme.dark）。
 * 用它把 t(cond ? 'a.b' : 'a.c') 里的非 key 字面量（例如 'dark'）排除掉。
 * 下面有一条用例断言所有已定义的 key 都符合这个形状，避免过滤器漏掉真 key。
 */
const KEY_SHAPE = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/

/** 从 i18n.tsx 里抽出某个字典的字面 key */
function extractKeys(source: string, name: 'zh' | 'en'): string[] {
  const header = `const ${name}: Record<string, string> = {`
  const start = source.indexOf(header)
  expect(start, `i18n.tsx 里找不到 ${name} 字典的声明`).toBeGreaterThan(-1)
  const end = source.indexOf('\n}', start)
  expect(end, `${name} 字典没有配对的结束大括号`).toBeGreaterThan(start)
  const body = source.slice(start + header.length, end)
  return Array.from(body.matchAll(/'([^']+)':/g), m => m[1])
}

function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue
        walk(full)
      } else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.includes('.test.')) {
        out.push(full)
      }
    }
  }
  walk(SRC_DIR)
  return out
}

/**
 * 收集所有 t(...) 调用参数里出现的字符串字面量。
 * 用括号配对取整个参数，这样 t(cond ? 'a' : 'b') 这种条件调用也能收到。
 */
function collectUsedKeys(files: string[]): Map<string, string[]> {
  const used = new Map<string, string[]>()
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    let from = 0
    while (true) {
      const at = src.indexOf('t(', from)
      if (at === -1) break
      from = at + 2
      const prev = src[at - 1]
      // 排除 setT( / getT( / view.t( 这类别的标识符结尾的 t(
      if (prev && /[A-Za-z0-9_$.]/.test(prev)) continue
      let depth = 0
      let quote: string | null = null
      let end = -1
      for (let i = at + 1; i < src.length; i++) {
        const c = src[i]
        if (quote) {
          if (c === '\\') { i++; continue }
          if (c === quote) quote = null
          continue
        }
        if (c === "'" || c === '"' || c === '`') { quote = c; continue }
        if (c === '(') depth++
        else if (c === ')') { depth--; if (depth === 0) { end = i; break } }
      }
      if (end === -1) continue
      const arg = src.slice(at + 2, end)
      for (const m of arg.matchAll(/'([^']+)'/g)) {
        if (!KEY_SHAPE.test(m[1])) continue
        const list = used.get(m[1]) ?? []
        list.push(relative(SRC_DIR, file))
        used.set(m[1], list)
      }
    }
  }
  return used
}

describe('C17 i18n key 不变量', () => {
  const source = readFileSync(I18N_FILE, 'utf8')
  const zhKeys = extractKeys(source, 'zh')
  const enKeys = extractKeys(source, 'en')

  it('两份字典都解析到了内容（防止正则失配导致后面空过）', () => {
    expect(zhKeys.length).toBeGreaterThan(50)
    expect(enKeys.length).toBeGreaterThan(50)
  })

  it('单份字典内部没有重复 key', () => {
    const dupZh = zhKeys.filter((k, i) => zhKeys.indexOf(k) !== i)
    const dupEn = enKeys.filter((k, i) => enKeys.indexOf(k) !== i)
    expect(dupZh, `zh 字典重复 key: ${dupZh.join(', ')}`).toEqual([])
    expect(dupEn, `en 字典重复 key: ${dupEn.join(', ')}`).toEqual([])
  })

  it('所有 key 都符合扫描器认的 key 形状（否则过滤器会漏掉真 key）', () => {
    const badShape = [...zhKeys, ...enKeys].filter(k => !KEY_SHAPE.test(k))
    expect(badShape, `形状不符的 key: ${badShape.join(', ')}`).toEqual([])
  })

  it('zh 与 en 的 key 集合一一对应', () => {
    const zh = new Set(zhKeys)
    const en = new Set(enKeys)
    expect(zhKeys.length).toBe(enKeys.length)
    const onlyZh = [...zh].filter(k => !en.has(k))
    const onlyEn = [...en].filter(k => !zh.has(k))
    expect(onlyZh, `只在 zh 里有的 key: ${onlyZh.join(', ')}`).toEqual([])
    expect(onlyEn, `只在 en 里有的 key: ${onlyEn.join(', ')}`).toEqual([])
  })

  it('代码里 t(...) 引用的每个 key 都有定义（否则会静默回落成 key 字符串）', () => {
    const defined = new Set(zhKeys)
    const used = collectUsedKeys(sourceFiles())
    expect(used.size).toBeGreaterThan(20)
    const missing = [...used.keys()].filter(k => !defined.has(k)).sort()
    const where = missing.map(k => `${k} (${[...new Set(used.get(k))].join(', ')})`)
    expect(missing, `以下 key 被引用但未定义: ${where.join(' | ')}`).toEqual([])
  })

  it('每条被引用的 key 在中英两边都存在（避免只补一边）', () => {
    const zh = new Set(zhKeys)
    const en = new Set(enKeys)
    const oneSided = [...collectUsedKeys(sourceFiles()).keys()]
      .filter(k => zh.has(k) !== en.has(k))
      .sort()
    expect(oneSided, `只存在于一侧的 key: ${oneSided.join(', ')}`).toEqual([])
  })
})