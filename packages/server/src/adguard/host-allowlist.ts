import { BlockList, isIP } from 'node:net'

/**
 * #2: baseUrl 主机白名单（堵 SSRF 的任意主机）。
 *
 * 未设置 `ADGH_ALLOWED_HOSTS` 时的默认策略——家庭内网工具该站在安全一侧：
 *   允许：127.0.0.0/8（回环）、10.0.0.0/8、172.16.0.0/12、192.168.0.0/16（RFC1918 私网）、
 *         ::1（IPv6 回环）、fc00::/7（IPv6 ULA 私网）、localhost
 *   拒绝：其余一切，包括公网地址、链路本地 169.254.0.0/16（含云厂商元数据端点）与 fe80::/10
 *
 * 设置了 `ADGH_ALLOWED_HOSTS` 时**整张名单替换默认值**（不是叠加）：逗号分隔，元素可以是
 * 主机名、IPv4/IPv6 字面量或 CIDR。想放开公网就把目标主机加进去，例如
 * `ADGH_ALLOWED_HOSTS=adguard.example.com`；此时回环也要显式写，否则会被拒。
 *
 * 形如 `x/y` 但 CIDR 不合法的项按主机名存，永远匹配不上，等价于无效项（不抛异常）。
 */
export const DEFAULT_ALLOWED_HOSTS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '::1',
  'fc00::/7',
  'localhost',
].join(',')

export interface HostAllowlist {
  allows(hostname: string): boolean
}

/** 去掉 URL 解析器给 IPv6 主机加上的方括号 */
function stripBrackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

export function buildHostAllowlist(spec: string = DEFAULT_ALLOWED_HOSTS): HostAllowlist {
  const hostnames = new Set<string>()
  const blockList = new BlockList()

  for (const raw of spec.split(',')) {
    const entry = raw.trim()
    if (!entry) continue

    const slash = entry.lastIndexOf('/')
    if (slash > 0) {
      const network = entry.slice(0, slash).trim()
      const prefix = Number(entry.slice(slash + 1))
      const family = isIP(network)
      const bits = family === 4 ? 32 : family === 6 ? 128 : 0
      if (family !== 0 && Number.isInteger(prefix) && prefix >= 0 && prefix <= bits) {
        blockList.addSubnet(network, prefix, family === 4 ? 'ipv4' : 'ipv6')
        continue
      }
      hostnames.add(entry.toLowerCase())
      continue
    }

    const family = isIP(entry)
    if (family === 4 || family === 6) {
      blockList.addAddress(entry, family === 4 ? 'ipv4' : 'ipv6')
      continue
    }
    hostnames.add(entry.toLowerCase())
  }

  return {
    allows(hostname: string): boolean {
      const host = stripBrackets(hostname.trim()).toLowerCase()
      if (!host) return false
      if (hostnames.has(host)) return true

      const family = isIP(host)
      if (family === 4) return blockList.check(host, 'ipv4')
      if (family === 6) return blockList.check(host, 'ipv6')
      return false
    },
  }
}