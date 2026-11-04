import { describe, expect, it } from 'vitest'
import { DEFAULT_ALLOWED_HOSTS, buildHostAllowlist } from './host-allowlist.js'

describe('ADGH_ALLOWED_HOSTS 默认策略（未设置时）', () => {
  const allow = buildHostAllowlist(DEFAULT_ALLOWED_HOSTS)

  it('回环可通过', () => {
    for (const host of ['127.0.0.1', '127.5.6.7', 'localhost', 'LocalHost', '::1', '[::1]']) {
      expect(allow.allows(host), host).toBe(true)
    }
  })

  it('RFC1918 私网与 IPv6 ULA 可通过', () => {
    for (const host of ['10.0.0.1', '10.255.255.254', '172.16.0.1', '172.31.255.254', '192.168.1.88', 'fd00::1', 'fc12::abcd']) {
      expect(allow.allows(host), host).toBe(true)
    }
  })

  it('公网地址被拒', () => {
    for (const host of ['8.8.8.8', '1.1.1.1', '203.0.113.9', '172.15.0.1', '172.32.0.1', '192.169.0.1', '2001:4860::1', '172.32.0.1']) {
      expect(allow.allows(host), host).toBe(false)
    }
  })

  it('链路本地（含云元数据）被拒', () => {
    for (const host of ['169.254.169.254', 'fe80::1']) {
      expect(allow.allows(host), host).toBe(false)
    }
  })

  it('主机名默认只放 localhost，其余主机名被拒', () => {
    expect(allow.allows('adguard.example.com')).toBe(false)
  })

  it('空串与非 IP 字符串一律拒，不抛', () => {
    for (const host of ['', '   ', 'not a host']) {
      expect(() => allow.allows(host)).not.toThrow()
      expect(allow.allows(host), JSON.stringify(host)).toBe(false)
    }
  })
})

describe('ADGH_ALLOWED_HOSTS 显式设置时替换默认', () => {
  const allow = buildHostAllowlist('ag.example.com, 192.168.1.0/24, ::1')

  it('名单里的主机名与网段可通过', () => {
    expect(allow.allows('ag.example.com')).toBe(true)
    expect(allow.allows('AG.EXAMPLE.COM')).toBe(true)
    expect(allow.allows('192.168.1.88')).toBe(true)
    expect(allow.allows('::1')).toBe(true)
  })

  it('名单外的被拒，包括默认名单里有的 —— 是替换不是叠加', () => {
    expect(allow.allows('127.0.0.1')).toBe(false)
    expect(allow.allows('localhost')).toBe(false)
    expect(allow.allows('10.0.0.5')).toBe(false)
    expect(allow.allows('192.168.9.1')).toBe(false)
  })

  it('非法 CIDR 项不抛异常，按主机名存（永远匹配不上）', () => {
    const broken = buildHostAllowlist('192.168.0.0/33, 10.0.0.0/xyz, ,')
    expect(() => broken.allows('192.168.0.1')).not.toThrow()
    expect(broken.allows('192.168.0.1')).toBe(false)
    expect(broken.allows('10.0.0.1')).toBe(false)
  })
})