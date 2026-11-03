import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

import { buildApp } from './app.js'
import type { AdguardConfig } from './adguard/client.js'

const PORT = parseInt(process.env.PORT ?? '3080', 10)
const HOST = process.env.HOST
const AUTH_USER = process.env.ADGH_AUTH_USER
const AUTH_PASSWD = process.env.ADGH_AUTH_PASSWD
const authEnabled = Boolean(AUTH_USER && AUTH_PASSWD)

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

/** C2: HOST 不设时无条件默认回环；未配凭据时显式非回环 fail-closed（返回 null 即启动退出） */
function resolveHost(): string | null {
  if (!HOST) return '127.0.0.1'
  if (authEnabled) return HOST
  return LOOPBACK_HOSTS.has(HOST) ? HOST : null
}

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
  const host = resolveHost()
  if (host === null) {
    console.error(`❌ 未配置 ADGH_AUTH_USER / ADGH_AUTH_PASSWD 时，HOST 只能绑回环地址 (127.0.0.1 / localhost / ::1)，当前 HOST=${HOST}`)
    console.error('   要么把 HOST 改成 127.0.0.1，要么配置准入凭据 ADGH_AUTH_USER / ADGH_AUTH_PASSWD 后再对外监听。')
    process.exitCode = 1
    return
  }

  const adguardConfig = loadAdguardConfig()
  const app = buildApp({ adguardConfig })

  try {
    await app.listen({ port: PORT, host })
    console.log(`🚀 后端服务已启动: http://localhost:${PORT}`)
    console.log(`📡 API 健康检查: http://localhost:${PORT}/api/health`)

    if (authEnabled) {
      console.log('🔒 auth enabled (HTTP Basic)')
    }

    if (adguardConfig) {
      console.log(`🔗 AdGuardHome 已配置: ${adguardConfig.baseUrl}`)
    }
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

start()
