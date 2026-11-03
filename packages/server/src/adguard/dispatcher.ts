import { Agent } from 'undici'

/**
 * Node 的 fetch 认 dispatcher，但工程里生效的那份 RequestInit（lib.dom）没声明这个字段，
 * 所以这里显式并一下，避免每个调用点各写一个 as any。
 */
export type FetchInit = RequestInit & { dispatcher?: Agent }

/**
 * C8: TLS 校验从进程级开关改成按请求传 dispatcher。
 * 原先改的是 Node 的全局 TLS 校验环境变量（进程级、设了没人写回，对所有出站 TLS 永久生效）；
 * 这里 true/false 各缓存一个 Agent（每次请求新建会漏连接池）。
 */
const agents = new Map<boolean, Agent>()

export function dispatcherFor(rejectUnauthorized: boolean): Agent {
  const cached = agents.get(rejectUnauthorized)
  if (cached) return cached

  const agent = new Agent({ connect: { rejectUnauthorized } })
  agents.set(rejectUnauthorized, agent)
  return agent
}