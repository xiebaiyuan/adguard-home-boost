# AdGuardHome DNS 延时分析

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](package.json)

AdGuardHome 突然变慢了？上游服务器被打满，域名一直在超时，但你不知道是谁在拖后腿。

这个工具从 AdGuardHome 查询日志中**按域名聚合延时分布**，让你一眼看到：
- 哪个域名最慢——P50 / P95 / P99 延时排行榜，排序即见
- 是缓存没命中还是上游真的慢——uncached 和 all 分开统计
- 哪个上游在拖后腿——行内展开直接看每个域名的上游服务器延时明细
- 超时的到底是谁——>500ms 慢查询、>1s 严重、>3s 超时，按域名分级展示

无需改配置，浏览器里填 AdGuardHome 地址就行。开源，MIT。

## 截图预览

| 视图 | 预览 |
|------|------|
| 📊 **仪表盘总览** | ![仪表盘](docs/screenshots/dashboard-overview.png) |
| 📋 **域名延时排行**（含上游下钻） | ![域名表格](docs/screenshots/domain-table.png) |
| 📈 **实时统计面板**（图表、屏蔽比例、客户端排行） | ![统计面板](docs/screenshots/stats-panel.png) |

---

## 功能

- **延时分布统计** — 每个域名：P20 / P50 / P80 / P95 / P99 / Max / Avg / Min，支持排序筛选
- **缓存感知** — 缓存命中与 uncached 分开统计，区分"真实上游性能"和"用户体验"
- **慢查询分级** — >500ms（慢）、>1s（严重）、>3s（超时），按域名展示慢查询率和严重率
- **查询类型分析** — 区分 A / AAAA / PTR / MX 等记录类型，支持按类型筛选
- **上游下钻** — 行内展开查看每个域名的上游服务器延时明细，定位瓶颈
- **深色/浅色模式** — 跟随系统 + 手动切换
- **CSV 导出** — 导出统计摘要或原始日志，供进一步离线分析
- **网页配置** — 无需编辑配置文件，浏览器内填写 AdGuardHome 连接信息

## 架构

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│ 浏览器 SPA   │────▶│ Fastify 后端  │────▶│  AdGuardHome API  │
│ (Vite+React) │◀────│ + 分析引擎    │◀────│  /control/querylog│
└─────────────┘     └─────────────┘     └──────────────────┘
                         │缓存
                    ┌────▼────┐
                    │ 内存缓存  │
                    └─────────┘
```

### 技术栈

| 层 | 技术 |
|----|------|
| **前端** | Vite + React + shadcn/ui + Recharts (Tailwind v4, 响应式, 移动端适配) |
| **后端** | Fastify + TypeScript (8 个 API 端点, 异步刷新, 内存缓存) |
| **分析引擎** | 纯函数式设计, 单元测试全覆盖, 支持空输入/单条/批量 |
| **构建** | npm workspaces monorepo, Docker 多阶段构建 |

### 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/analysis/summary` | GET | 缓存状态 + 统计概览 KPI |
| `/api/analysis/domains` | GET | 按域名聚合的统计数据（支持 `type` / `search` / `sort` / `order` / `limit`） |
| `/api/analysis/domains/:domain` | GET | 该域名的上游明细 + 原始查询列表（含分页） |
| `/api/analysis/stats` | GET | 直接获取 AdGuardHome 原始统计概览 |
| `/api/analysis/refresh` | POST | 触发后端重新拉取 AdGuardHome 数据（异步） |
| `/api/config` | POST | 配置 AdGuardHome 连接信息（URL / 用户名 / 密码） |
| `/api/adguard/*` | GET/POST | 通用 AdGuardHome 管理 API 代理 |
| `/api/health` | GET | 后端健康检查 |

---

## 快速开始

### 前置条件

- Node.js >= 18
- 可访问的 AdGuardHome 实例（局域网内或 localhost）

### 安装与启动

```bash
# 1. 克隆仓库
git clone https://github.com/xiebaiyuan/adguard-dns-latency.git
cd adguard-dns-latency

# 2. 安装依赖
npm install

# 3. 启动（开发模式）
npm run dev
# → 后端: http://localhost:3080
# → 前端: http://localhost:5173
```

### 使用 Docker

```bash
# 拉取镜像
docker pull xiebaiyuan/adguard-dns-latency:latest

# 运行
docker run -d \
  --name adguard-dns-latency \
  -p 3080:3080 \
  -e ADGH_URL=http://192.168.8.88 \
  -e ADGH_USER=your_username \
  -e ADGH_PASSWD=your_password \
  -e ADGH_SKIP_VERIFY=true \
  xiebaiyuan/adguard-dns-latency:latest
```

或者使用 docker-compose（参考 [docker-compose.yml](docker-compose.yml)）。

### 配置 AdGuardHome 连接

启动后打开 `http://localhost:5173/`，点击工具栏的 ⚙️ 齿轮图标，填入：

| 字段 | 值 |
|------|-----|
| 地址 | `http://192.168.8.97`（你的 AdGuardHome 内网地址） |
| 用户名 | AdGuardHome 管理员用户名 |
| 密码 | AdGuardHome 管理员密码 |

保存后点击"刷新"即可拉取数据。

也可通过 `.env` 文件预设默认值（参考 [.env.example](.env.example)）。

### 禁用 SSL 验证（自签名证书）

参见 [SSL 证书说明](docs/SSL.md)。

---

## 项目结构

```
adguard-dns-latency/
├── packages/
│   ├── server/                    # Fastify 后端
│   │   └── src/
│   │       ├── analyze.ts         # 分析引擎（深模块）
│   │       ├── app.ts             # Fastify 应用 + API 路由
│   │       ├── index.ts           # 入口
│   │       └── adguard/
│   │           ├── client.ts      # AdGuardHome API 客户端
│   │           └── fetcher.ts     # 数据拉取编排
│   └── client/                    # React 前端 SPA
│       └── src/
│           ├── components/        # UI 组件（仪表盘 / 表格 / 图表 / 配置面板）
│           ├── hooks/             # 主题 + 数据拉取 Hooks
│           └── lib/               # 类型定义 + CSV 导出
├── shared/
│   └── types.ts                   # 前后端共享类型
├── docs/
│   └── SSL.md                     # SSL 证书处理说明
├── .env.example                   # 环境变量模板
├── Dockerfile                     # 多阶段构建
├── docker-compose.yml             # Docker Compose 配置
└── package.json                   # npm workspaces monorepo 配置
```

## 开发

```bash
# 运行测试
npm test

# 构建
npm run build

# 仅启动后端
npm run dev -w @adgh/server

# 仅启动前端
npm run dev -w @adgh/dashboard

# 运行后端测试（含覆盖率）
cd packages/server && npx vitest run --coverage
```

## 测试覆盖

| 模块 | 测试数 |
|------|--------|
| **后端** (server) | **20** |
| ├ 分析引擎（百分位/缓存/慢查询率） | 8 |
| ├ AdGuardHome 客户端（mock server） | 3 |
| ├ 数据拉取编排（mock server） | 1 |
| ├ API 端点（Fastify inject） | 7 |
| └ API 端点 / 刷新 / 配置 | 1 |
| **前端** (dashboard) | **18** |
| ├ CSV 导出 | 4 |
| └ 格式化工具（延时/时间戳/字节数） | 14 |
| **总计** | **38** |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ADGH_URL` | AdGuardHome 服务器地址 | — |
| `ADGH_USER` | AdGuardHome 用户名 | — |
| `ADGH_PASSWD` | AdGuardHome 密码 | — |
| `ADGH_SKIP_VERIFY` | 跳过 SSL 证书验证 | `false` |
| `PORT` | 服务监听端口 | `3080` |
| `HOST` | 服务监听地址 | `0.0.0.0` |

---

## 许可证

MIT
