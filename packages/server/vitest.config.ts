import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      // 阈值=2026-11-03 实测值向下留 2 个点：stmts/lines 83.16、branch 84.26、funcs 96。
      // 目的是防倒退，不是逼着补测试；实测值变了要同步改这里。
      thresholds: { statements: 81, lines: 81, branches: 82, functions: 94 },
    },
  },
})