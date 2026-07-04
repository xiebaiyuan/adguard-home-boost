import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('phosphor-icons')) return 'vendor-icons'
          // 只钉住急加载的 react 生态；recharts 及其依赖树（d3/redux/immer...）
          // 不指定 chunk，让 Rollup 跟随 lazy import 自动放入懒加载 chunk
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor'
        },
      },
    },
  },
})
