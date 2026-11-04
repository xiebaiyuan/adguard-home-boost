// 客户端测试的环境补丁，由 packages/client/vitest.config.ts 的 test.setupFiles 引入。
//
// 实测（vitest 3.2.7 + jsdom 29 + Node 26）：jsdom 环境下 `typeof window === 'object'`，但
// `window.localStorage` 和 `globalThis.localStorage` 都是 undefined —— Node 22+ 在 globalThis 上
// 占了一个 lazy 的 localStorage getter，vitest 的 jsdom 层没有把它透出来。所以不能拷
// `window.localStorage`（那等于再赋一次 undefined），得按 Storage 的形状自己装一个。
//
// 实现复用 src/test-support/memory-storage.ts（测试专用，应用代码不引用）：它在已有可用实现时
// 直接返回、不覆盖，缺失时按 Storage 形状装内存实现。项目源码用的是裸 global，见
// i18n.tsx:217/222、useTheme.tsx、useAnalysis.ts、Dashboard.tsx、CollapseSection.tsx、SettingsDialog.tsx。
//
// 先判 window：本包 vitest 配置的 environment 是 'node'，纯函数测试文件里没有 window，
// 而 setup 对每个测试文件都会跑。
import { installMemoryStorage } from './src/test-support/memory-storage'

if (typeof window !== 'undefined') {
  installMemoryStorage()
}