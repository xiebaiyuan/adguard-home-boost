import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

import { buildApp } from './app.js'
import type { AdguardConfig } from './adguard/client.js'

const PORT = parseInt(process.env.PORT ?? '3080', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

function loadAdguardConfig(): AdguardConfig | null {
  const url = process.env.ADGH_URL
  const user = process.env.ADGH_USER
  const pass = process.env.ADGH_PASSWD

  if (!url || !user || !pass) {
    console.warn('⚠️  AdGuardHome 环境变量未配置 (ADGH_URL, ADGH_USER, ADGH_PASSWD)')
    console.warn('   请创建 .env 文件或通过网页配置面板设置')
    return null
  }

  const skipVerify = process.env.ADGH_SKIP_VERIFY === 'true'

  // 自签名证书: 关闭 Node.js SSL 验证
  if (skipVerify) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  return {
    baseUrl: url,
    username: user,
    password: pass,
    rejectUnauthorized: !skipVerify,
  }
}

async function start() {
  const adguardConfig = loadAdguardConfig()
  const app = buildApp({ adguardConfig })

  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`🚀 后端服务已启动: http://localhost:${PORT}`)
    console.log(`📡 API 健康检查: http://localhost:${PORT}/api/health`)

    if (adguardConfig) {
      console.log(`🔗 AdGuardHome 已配置: ${adguardConfig.baseUrl}`)
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()
