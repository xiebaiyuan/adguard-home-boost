# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev — concurrent backend + frontend with hot-reload
npm run dev
# → Backend: http://localhost:3080 (tsx watch)
# → Frontend: http://localhost:5173 (Vite dev server, proxies /api to 3080)

# Run all tests (server then client)
npm test

# Server tests only
npm run test -w @adgh/server
npm run test:watch -w @adgh/server   # watch mode
npx vitest run --coverage            # with coverage (run from packages/server/)

# Client tests only
npm run test -w @adgh/dashboard

# Build all (tsc + vite)
npm run build

# Lint client
npm run lint -w @adgh/dashboard

# Docker
docker build -t xiebaiyuan/adguard-home-boost:latest .
docker compose up -d
```

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
  - `app.ts`: Fastify instance factory with 8 API routes
  - `analyze.ts`: Pure-function analysis engine — groups entries by domain, computes percentile latency stats (P20/P50/P80/P95/P99), cache hit rates, slow query rates
  - `adguard/client.ts`: Cursor-based pagination client for AdGuardHome `/control/querylog` API (pages of 500, max 100k entries)
  - `adguard/fetcher.ts`: Orchestrates fetch → analyze → group-by-domain pipeline
  - Cached results in process memory; cache invalidates on config change or manual refresh

- **`packages/client/`** — Vite + React SPA (shadcn/ui + Tailwind v4 + Recharts)
  - Custom CSS color system (glassmorphism, oklch colors, dark/light mode)
  - `hooks/useAnalysis.ts`: Data fetching lifecycle — auto-restore last config, exponential backoff polling (1s→2s→2s...), renders all sections as always-mounted (CSS hidden when collapsed)
  - `hooks/useAdguard.ts`: AdGuardHome management API proxy (protection toggle, filters, rewrites)
  - Components mounted from page load; CollapseSection uses `display:none` instead of conditional mount to avoid unmount/remount jank
  - `lib/format.ts`: Server-free sorting/filtering of domain stats on the client
  - Bundle manually chunked: vendor / vendor-charts / vendor-icons / app

- **`shared/`** — TypeScript types shared between frontend and backend
  - `QueryLogEntry` (raw AdGuardHome query)
  - `LatencyStats` (percentile + slow rate + severe rate)
  - `DomainStats` (per-domain aggregate with cached/uncached split)
  - `AnalysisResult = DomainStats[]`

## Key Data Flow

1. **User configures AdGuardHome connection** → `POST /api/config` saves to backend memory + localStorage
2. **User clicks refresh** → `POST /api/analysis/refresh` → backend fetches query log via cursor pagination → `analyze()` groups by domain → caches result in memory (async, 202 Accepted)
3. **Frontend polls** `GET /api/analysis/summary` with exponential backoff until `ready: true`
4. **Frontend renders** by calling `GET /api/analysis/domains?limit=500` — all sorting/filtering happens in `lib/format.ts` on the client
5. **Domain drill-down** → `GET /api/analysis/domains/:domain` (upstream breakdown + recent entries)

## Analysis Engine (src/analyze.ts)

Pure function `analyze(entries: QueryLogEntry[]) → DomainStats[]`:
- Single-pass grouping by `question.name`
- Per-domain single-pass aggregation (cached count, uncached latencies, query types)
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
- Recharts and phosphor-icons auto-chunked by Vite build config
- Skeleton screens removed in favor of content placeholder + CSS fade-in
