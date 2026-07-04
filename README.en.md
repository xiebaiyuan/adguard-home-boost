# AdGuard Home Dashboard

<a href="README.md"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 2px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> 中文版</a> · [![Release](https://img.shields.io/github/v/release/xiebaiyuan/adguard-dns-latency)](https://github.com/xiebaiyuan/adguard-dns-latency/releases) ![License](https://img.shields.io/badge/License-MIT-yellow.svg) ![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

Enhanced AdGuardHome management panel. Aggregates query log latency analysis, real-time stats, and DNS management.

## Screenshots

<img src="docs/screenshots/1.png" width="720">  
<img src="docs/screenshots/4.png" width="720">  
<img src="docs/screenshots/3.png" width="720">  
<img src="docs/screenshots/2.png" width="720">

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

### 📊 Latency Analysis
- **Per-domain Aggregation** — P20 / P50 / P60 / P70 / P95 / P99 / Max / Avg / Min, sortable and filterable
- **Cache-Aware Stats** — Separate cached vs uncached stats to distinguish real upstream performance
- **Slow Query Grading** — >500ms slow, >1s severe, per-domain slow & severe rate
- **Latency Heat Map** — Green → yellow → red bar chart showing P95 distribution at a glance
- **Trend Chart** — Dual Y-axis (query count + block rate) with 3-day SMA smoothing

### 🎛️ DNS Management
- **Protection Toggle** — One-click pause/resume DNS protection with optimistic UI updates
- **Safe Browsing & Parental Control** — Toggle on/off, instant effect
- **DNS Rewrites** — Manage custom rewrite rules
- **Filter Management** — Add/enable/disable/delete filter subscriptions
- **Custom Rules** — Edit custom filtering rules
- **Maintenance** — Reset stats, clear query log, clear DNS cache

### 📈 Real-time Stats
- **Block Ratio Donut Chart** — Display total and percentage
- **Query Type Distribution** — A / AAAA / PTR / HTTPS breakdown
- **Top Clients** — Source IPs and device names with query counts
- **Top Blocked Domains** — Most frequently blocked domains
- **Upstream Response** — Per-upstream response count and average time

### 🔍 Domain Drill-Down
- **Client Sources** — Expand to see which devices (IP + name) query each domain
- **Block Rule Identification** — Blocked queries show which rule triggered
- **Upstream Details** — Per-DNS-upstream query count and average latency
- **Resolved Addresses + TTL** — IP records with TTL ranges
- **Recent Query Log** — Last 20 queries per domain, exportable as CSV

### 🌐 Internationalization
- **Chinese / English** — Auto-detect browser language + manual toggle in header
- **Dark / Light Mode** — Follow system + manual toggle with synchronized transitions

### 🚀 UX Enhancements
- **KPI Overview** — Total queries, cache hit rate, P50/P95 latency in a fixed layout (no layout shift)
- **Multi-Profile** — Save multiple AdGuardHome connections for quick switching
- **Time Range** — 24h / 7 days / 30 days analysis window
- **Entrance Fade-In** — Page mounts with a smooth fade-in from transparent
- **CSV Export** — Export summary stats or raw query logs
- **Lazy-Loaded Charts** — Recharts loads only when stats panel is expanded
- **Shimmer Loading** — Content placeholders during load, fade-in when ready

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Browser SPA  │────▶│ Fastify API  │────▶│ AdGuardHome API  │
│ (Vite+React) │◀────│ + Analysis   │◀────│ /control/querylog│
└─────────────┘     └─────────────┘     └──────────────────┘
                         │ In-Memory
                    ┌────▼────────┐
                    │ 5-min TTL   │
                    └─────────────┘
```

Frontend: Vite + React + Tailwind v4 + Recharts + Phosphor Icons. Backend: Fastify + TypeScript, 8 API endpoints, in-memory cache.

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
