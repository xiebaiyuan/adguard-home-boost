import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // jsdom 环境下 localStorage 的兜底，见 vitest.setup.ts
    setupFiles: [fileURLToPath(new URL('./vitest.setup.ts', import.meta.url))],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      // test-support 是纯测试支撑（内存 Storage 兜底），不算生产代码；*_ENV 等测试专用目录一并列在这里
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/vite-env.d.ts', 'src/test-support/**'],
      // 阈值=2026-11-03 实测值向下留 2 个点（已排除 test-support）：stmts/lines 19.61、branch 66.66、funcs 54.76。
      // 组件与 App/main 还没测，基数低，这条只防倒退；实测值上来了要同步抬高。
      thresholds: { statements: 17, lines: 17, branches: 64, functions: 52 },
    },
  },
})
