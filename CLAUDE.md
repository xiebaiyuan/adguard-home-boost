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
docker build -t xiebaiyuan/adguard-dns-latency:latest .
docker compose up -d
```

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
