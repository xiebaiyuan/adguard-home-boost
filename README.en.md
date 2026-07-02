# AdGuardHome DNS Latency Analyzer

<p align="center">
  <a href="README.md"><strong>🇨🇳 中文版</strong></a> ·
  <img src="https://img.shields.io/github/v/release/xiebaiyuan/adguard-dns-latency" alt="Release">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node">
</p>

<p align="center">
  Aggregate DNS latency by domain from AdGuardHome query logs. Pinpoint slow queries and upstream bottlenecks.
</p>

## Screenshots

<p align="center">
  <img src="docs/screenshots/dashboard-overview.png" width="720">
</p>
<p align="center">
  <img src="docs/screenshots/domain-table.png" width="720">
</p>
<p align="center">
  <img src="docs/screenshots/stats-panel.png" width="720">
</p>

## Quick Start

```bash
git clone https://github.com/xiebaiyuan/adguard-dns-latency.git
cd adguard-dns-latency
npm install
npm run dev
# Backend http://localhost:3080
# Frontend http://localhost:5173
```

Open the browser, click ⚙️, enter your AdGuardHome URL, username, and password, then click Refresh.

Or with Docker:

```bash
docker run -d --name adguard-dns-latency \
  -p 3080:3080 \
  -e ADGH_URL=http://192.168.8.88 \
  -e ADGH_USER=your_username \
  -e ADGH_PASSWD=your_password \
  -e ADGH_SKIP_VERIFY=true \
  xiebaiyuan/adguard-dns-latency:latest
```

## Features

- **Latency Distribution** — P20 / P50 / P60 / P70 / P80 / P95 / P99 / Max / Avg / Min per domain, sortable and filterable
- **Cache-Aware** — Cached vs uncached stats, separate real upstream performance from user experience
- **Slow Query Grading** — >500ms slow, >1s severe, >3s timeout, per-domain slow rate
- **Upstream Drill-Down** — Inline expand to see per-upstream latency for any domain
- **Resolved Addresses + TTL** — Show resolved IPs with TTL ranges and recent queries
- **Live Stats** — Block ratio, query type distribution, top clients, upstream response times, trend chart
- **Dark/Light Mode** — System preference + manual toggle
- **CSV Export** — Export summary or raw logs
- **LLM-Ready Report** — One-click copy report for ChatGPT / Claude

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Browser SPA  │────▶│ Fastify API  │────▶│ AdGuardHome API  │
│ (Vite+React) │◀────│ + Analysis   │◀────│ /control/querylog│
└─────────────┘     └─────────────┘     └──────────────────┘
                         │ Cache
                    ┌────▼────────┐
                    │ In-Memory Cache │
                    └────────────────┘
```

Frontend: Vite + React + shadcn/ui + Recharts. Backend: Fastify + TypeScript, 8 API endpoints, in-memory cache.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADGH_URL` | AdGuardHome URL | — |
| `ADGH_USER` | Username | — |
| `ADGH_PASSWD` | Password | — |
| `ADGH_SKIP_VERIFY` | Skip SSL verification | `false` |
| `PORT` | Server port | `3080` |
| `HOST` | Listen address | `0.0.0.0` |

## Credits

Data powered by [AdGuardHome](https://github.com/AdguardTeam/AdGuardHome) query log API.

## License

MIT
