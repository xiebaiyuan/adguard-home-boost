import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp, resolveAppVersion } from '../app.js'

const CLIENT_PACKAGE = resolve(import.meta.dirname, '../../../client/package.json')

afterEach(() => {
  delete process.env.APP_VERSION
})

describe('#24 /api/health 的版本号来自 packages/client/package.json', () => {
  it('返回 client package.json 里的 version（不是写死的服务端值）', async () => {
    const expected = (JSON.parse(readFileSync(CLIENT_PACKAGE, 'utf8')) as { version: string }).version
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    expect(body.version).toBe(expected)
    // 服务端自己的 version 是 0.1.0；两者相等就说明还在读写死值
    expect(body.version).not.toBe('0.1.0')
    await app.close()
  })

  it('读不到文件时回落到 APP_VERSION，不抛', () => {
    process.env.APP_VERSION = '9.9.9-fallback'
    expect(resolveAppVersion('/nonexistent-root/adgh/base')).toBe('9.9.9-fallback')
  })

  it('读不到文件且没有 APP_VERSION 时回落 unknown，不抛', () => {
    delete process.env.APP_VERSION
    expect(resolveAppVersion('/nonexistent-root/adgh/base')).toBe('unknown')
  })
})