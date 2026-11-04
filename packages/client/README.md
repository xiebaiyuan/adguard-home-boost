# @adgh/dashboard

The AdGuard Home Boost SPA — Vite + React + Tailwind v4 + Recharts + Phosphor Icons.

The built `dist/` is served by the Fastify backend (`packages/server`), so in production this package ships static files only.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173, proxying `/api` to the backend on :3080 |
| `npm run build` | `tsc -b` then `vite build` into `dist/` |
| `npm run typecheck` | `tsc -b`, no emit |
| `npm run test` | Vitest |
| `npm run test:coverage` | Vitest with v8 coverage and the thresholds in `vitest.config.ts` |
| `npm run lint` | oxlint |
| `npm run bench:rerender` | jsdom benchmark of `DomainTable` re-render (500 rows), prints the median per keystroke |

Run `npm run dev` from the repo root instead of here if you also want the backend — that script starts both processes.

## Test environment

`vitest.config.ts` runs in the `node` environment by default. Files that need a DOM declare `// @vitest-environment jsdom` at the top instead.

`vitest.setup.ts` installs an in-memory `localStorage` when a DOM is present: Node 22+ reserves a lazy `localStorage` global that reads as `undefined` without `--localstorage-file`, and vitest's jsdom environment does not replace it. Application code uses the bare global, so the setup is what makes those tests work.

See the repo-root `CLAUDE.md` for architecture, data flow and the version constraint.