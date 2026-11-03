import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 字体走 JS import：Vite 会把 @font-face 里的 url(./files/*.woff2) 解析成产物资源
import '@fontsource-variable/outfit/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 触发根节点淡入：setTimeout 确保在首次渲染之后
setTimeout(() => document.getElementById('root')?.classList.add('entered'), 0)
