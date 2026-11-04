# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev — concurrent backend + frontend with hot-reload
npm run dev
# → Backend: http://localhost:3080 (tsx watch)
# → Frontend: http://localhost:5173 (Vite dev server, proxies /api to 3080)
#
# Access credentials (HTTP Basic): every route needs them, including /api/health
# and the static files. Set both ADGH_AUTH_USER and ADGH_AUTH_PASSWD to enable.
# With neither set, HOST must be a loopback address (127.0.0.1 / localhost / ::1),
# otherwise startup exits non-zero. Local dev: HOST=127.0.0.1 needs no credentials.

# Run all tests (server then client)
npm test

# Coverage with thresholds (both packages; falls below = non-zero exit)
npm run test:coverage

# Server tests only
npm run test -w @adgh/server
npm run test:watch -w @adgh/server   # watch mode

# Client tests only
npm run test -w @adgh/dashboard

# Typecheck / lint / build — the same four gates CI runs
npm run typecheck
npm run lint
npm run build

# Client re-render benchmark (jsdom, 500 rows, median per keystroke)
npm run bench:rerender -w @adgh/dashboard

# Docker
docker build -t xiebaiyuan/adguard-home-boost:latest .
docker compose up -d

# Release — validates, then tags and pushes
npm version <patch|minor|major> -w @adgh/dashboard
git add packages/client/package.json
npm run release   # scripts/release.mjs; --check validates without tagging
```

## Runtime

- Node 20.19+ or 22.12+ (`engines` in the root `package.json`). The Docker image and CI both pin Node 22.
- `packages/client/package.json` is the single version source for three things: the Vite `__APP_VERSION__` define, the release tag, and `GET /api/health`. The health route reads that file at startup from `../../client/package.json` relative to the compiled server, falling back to `process.env.APP_VERSION`, then `unknown` — so the Docker image must ship `packages/client/package.json` or health reports `unknown`.
- `ADGH_ALLOWED_HOSTS` guards the AdGuardHome address accepted by `POST /api/config` (default: loopback + RFC1918 + IPv6 ULA + `localhost`; setting it **replaces** the list). The `ADGH_URL` environment variable is the operator's own input and is not filtered by it.

## Version Constraint

**`__APP_VERSION__` 必须与 git tag 保持一致。**

- `packages/client/package.json` 的 `version` 字段是唯一版本来源，构建时通过 Vite `define` 注入为 `__APP_VERSION__`
- 发版流程：`npm version <patch|minor|major> -w @adgh/dashboard` → `git add packages/client/package.json` → `git commit` → `npm run release`（自动读取 version 打 tag 并推送）
- 禁止手动 `git tag` 不打版本号，或打了 tag 不更新 package.json
- 当前版本：`3.0.0`

## Workflow

### 每次提交前必须执行多维度代码审查

在 `git commit` 之前，必须使用 `/code-review-and-quality` skill（或等效的手动审查）对本次变更进行五轴审查：

| 维度 | 检查项 |
|------|--------|
| **Correctness** | 变更是否符合预期行为？边界/错误路径是否处理？测试是否覆盖？ |
| **Readability** | 命名是否清晰？逻辑是否直接？有无不必要的复杂性？ |
| **Architecture** | 是否遵循既有模式？有无不必要的耦合或重复？ |
| **Security** | 有无注入风险？外部数据是否在边界处做校验？ |
| **Performance** | 有无 N+1 查询？有无无界循环/数据拉取？大列表是否分页？ |

**变更粒度要求：**
- 提交尽量聚焦单一逻辑变更（一个 bugfix、一个 feature 的一部分）
- 重构和新功能分开提交
- 不要提交有死代码残留的变更

**提交前清单：**
- [ ] 运行 `npm test` 全部通过
- [ ] 运行 `npm run build` 构建成功
- [ ] 多维度代码审查已执行，Critical/Important 级别问题已修复
- [ ] 提交信息描述变更内容与原因（而非"fix bug"等无信息描述）

## Project Architecture

Monorepo with npm workspaces across three packages:

- **`packages/server/`** — Fastify backend (TypeScript, tsx watch for dev)
  - `app.ts`: Fastify instance factory with 9 API routes in production; `/api/debug/cache-check` is registered only outside production
  - `analyze.ts`: Pure-function analysis engine — groups entries by domain, computes percentile latency stats (P20/P50/P60/P70/P80/P95/P99), cache hit rates, slow query rates, blocked counts and top clients/rules
  - `adguard/client.ts`: Cursor-based pagination client for AdGuardHome `/control/querylog` API (pages of 500, max 100k entries)
  - `adguard/fetcher.ts`: Orchestrates fetch → analyze → group-by-domain pipeline
  - `adguard/host-allowlist.ts`: Host allowlist for the AdGuardHome address accepted by `POST /api/config` (`ADGH_ALLOWED_HOSTS`)
  - Cached results in process memory; cache invalidates on config change or manual refresh

- **`packages/client/`** — Vite + React SPA (Tailwind v4 + Recharts + Phosphor Icons)
  - Custom CSS color system (glassmorphism, oklch colors, dark/light mode)
  - `hooks/useAnalysis.ts`: Data fetching lifecycle — auto-restore last config, exponential backoff polling (1s→2s→4s→8s, then 8s, ~63s total before a visible timeout), `AbortController` cancellation on re-entry and unmount, renders all sections as always-mounted (CSS hidden when collapsed)
  - `hooks/useAdguard.ts`: AdGuardHome management API proxy (protection toggle, filters, rewrites)
  - `components/DomainTable.tsx`: renders 100 rows first (`ROWS_PER_PAGE`) and appends the next batch on demand
  - Components mounted from page load; CollapseSection uses `display:none` instead of conditional mount to avoid unmount/remount jank
  - `lib/format.ts`: Server-free sorting/filtering of domain stats on the client
  - Bundle manually chunked: vendor / vendor-icons / app (version injected via Vite `define`)

- **`shared/`** — TypeScript types shared between frontend and backend (the client imports them directly; `packages/client` no longer keeps a private copy)
  - `QueryLogEntry` (raw AdGuardHome query)
  - `LatencyStats` (percentile + slow rate + severe rate)
  - `DomainStats` (per-domain aggregate with cached/uncached split, blocked counts, top clients/rules)
  - `AnalysisResult = DomainStats[]`, plus `AnalysisSummary`, `DashboardPayload` and `AdguardStats` for the API responses

## Key Data Flow

1. **User configures AdGuardHome connection** → `POST /api/config` saves to backend memory + localStorage (the AdGuardHome address is checked against `ADGH_ALLOWED_HOSTS` first)
2. **User clicks refresh** → `POST /api/analysis/refresh` → backend fetches query log via cursor pagination → `analyze()` groups by domain → caches result in memory (async, 202 Accepted)
3. **Frontend polls** `GET /api/analysis/summary` with exponential backoff until `ready: true`
4. **Frontend renders** from a single `GET /api/analysis/dashboard` call — it returns the pre-aggregated KPIs plus up to 500 domain rows; sorting, filtering and paging then happen in the browser (`lib/format.ts`, `DomainTable`)
5. **Domain drill-down** → `GET /api/analysis/domain-detail?domain=...` (client sources, block rules, upstream breakdown + recent entries)

## Analysis Engine (src/analyze.ts)

Pure function `analyze(entries: QueryLogEntry[]) → DomainStats[]`:
- Single-pass grouping by `question.name`
- Per-domain single-pass aggregation (cached count, uncached latencies, query types, blocked reason buckets, clients, block rules)
- LatencyStats computed via D-def percentile interpolation on sorted array, with slow (>500ms) and severe (>1s) rates computed in a single pass

## Frontend State Management

No global state library. Component-local state + hooks:
- `useAnalysis`: Single hook wrapping fetch/cache/refresh/error lifecycle for the main analysis data
- `useAdguard`: AdGuardHome management operations (independent of analysis data)
- `useTheme`: Dark/light mode (system preference + manual toggle, persisted to localStorage)
- Panel collapse states persisted via localStorage

## Performance Considerations

- Analysis engine designed for 10k–100k entry datasets, single-pass O(n) algorithms
- Backend caches analysis results in process memory (not persisted)
- Recharts and phosphor-icons are split into lazy chunks by the Vite build config
- Loading placeholders are animated blocks (`@keyframes n` / `.n-bg` in `index.css`) that fade into content; there is no separate skeleton-screen component

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, driven by the `gh` CLI. See `obsidian-docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles mapped to label strings. See `obsidian-docs/agents/triage-labels.md`.

### Domain docs

Read `obsidian-docs/agents/domain.md` for how domain context is expected to be kept. This repo currently has no root `GLOSSARY.md` and no `obsidian-docs/adr/` directory; the vocabulary lives in `shared/types.ts` and the architecture notes above. Add the glossary before running a domain-modelling flow that expects one.
