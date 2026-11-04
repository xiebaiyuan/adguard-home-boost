#!/usr/bin/env node
// 发版闸门：校验 → 打 tag → 推送。加 --check 只校验，不打 tag 不推送。
//
// 先过四项校验，任一不过就非 0 退出并说明原因：
//   1. 工作树干净（git status --porcelain 为空）
//   2. HEAD 里的 packages/client/package.json 版本 == 工作区版本
//   3. 本地没有该 tag
//   4. 远端（origin）没有该 tag
//
// push 失败会自动删掉刚建的本地 tag 再退出，不留「本地有 tag、远端没有」的半成品。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION_FILE = 'packages/client/package.json'
const CHECK_ONLY = process.argv.includes('--check')

function fail(message) {
  console.error(`release: ${message}`)
  process.exit(1)
}

function git(args, { inherit = false, allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    })
  } catch (err) {
    if (allowFailure) return null
    const detail = String(err.stderr ?? '').trim() || err.message
    fail(`git ${args.join(' ')} 失败：${detail}`)
  }
}

function readVersion(text, where) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    fail(`解析 ${where} 失败，不是合法 JSON`)
  }
  if (typeof parsed.version !== 'string' || parsed.version === '') {
    fail(`${where} 里没有可用的 version 字段`)
  }
  return parsed.version
}

const worktreeVersion = readVersion(readFileSync(join(REPO_ROOT, VERSION_FILE), 'utf8'), VERSION_FILE)
const tag = `v${worktreeVersion}`

// 1. 工作树必须干净：把没提交的改动打上版本 tag 会指向另一个提交
const dirty = git(['status', '--porcelain'])
if (dirty) {
  fail(`工作树不干净，先提交或 stash 再发版：\n${dirty}`)
}

// 2. HEAD 里的版本必须等于工作区版本，否则 tag 与构建产物里的 __APP_VERSION__ 对不上
const headVersion = readVersion(git(['show', `HEAD:${VERSION_FILE}`]), `HEAD:${VERSION_FILE}`)
if (headVersion !== worktreeVersion) {
  fail(`版本不一致：HEAD 是 ${headVersion}，工作区是 ${worktreeVersion}。先把版本改动提交，再发版`)
}

// 3. 本地不能已有同名 tag
const localTag = git(['tag', '-l', tag])
if (localTag) {
  fail(`本地已存在 tag ${localTag}，确认不是重复发版后再处理`)
}

// 4. 远端也不能有（本地 tag 被删过或从别的机器推过的情况）
let remoteTag
try {
  remoteTag = execFileSync('git', ['ls-remote', '--tags', 'origin', tag], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
} catch (err) {
  const detail = String(err.stderr ?? '').trim() || err.message
  fail(`查远端 tag 失败（需要能访问 origin）：${detail}`)
}
if (remoteTag) {
  fail(`远端已存在 tag ${tag}，先确认是不是重复发版`)
}

if (CHECK_ONLY) {
  console.log(`release: 校验通过，可以发 ${tag}（--check 模式：不打 tag 不推送）`)
  process.exit(0)
}

console.log(`release: 打 tag ${tag}`)
git(['tag', tag], { inherit: true })

console.log(`release: 推送 ${tag} 到 origin`)
try {
  execFileSync('git', ['push', 'origin', tag], { cwd: REPO_ROOT, stdio: 'inherit' })
} catch {
  // push 失败要把刚建的本地 tag 删掉，别留「本地有 tag、远端没有」的半成品。
  // 这里不能走 git()：它在失败时会直接 process.exit，回滚就跑不到了。
  execFileSync('git', ['tag', '-d', tag], { cwd: REPO_ROOT, stdio: 'inherit' })
  fail(`push 失败，已回滚本地 tag ${tag}（远端未受影响，可修好网络后重跑）`)
}
console.log(`release: 完成 ${tag}`)