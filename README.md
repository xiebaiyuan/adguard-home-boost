# AdGuardHome DNS 延时分析

分析和诊断 AdGuardHome DNS 查询延时的工具。按域名聚合统计 P20~P99 延时分布，找出长尾慢查询进行进一步诊断。

## 功能

- **延时分布统计** — 每个域名的 P20 / P50 / P80 / P95 / P99 / Max / Avg / Min
- **缓存感知** — 缓存命中与 uncached 分开统计，区分"真实上游性能"和"用户体验"
- **慢查询分级** — >500ms（慢）、>1s（严重）、>3s（超时），按域名展示慢查询率
- **查询类型分析** — 区分 A / AAAA / PTR / MX 等记录类型，支持按类型筛选
- **上游下钻** — 行内展开查看每个域名的上游服务器延时明细
- **深色/浅色模式** — 跟随系统 + 手动切换
- **网页配置** — 无需编辑文件，浏览器内填写 AdGuardHome 连接信息
- **CSV 导出** — 导出统计或原始日志供进一步分析

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

- **前端**: Vite + React + shadcn/ui + Recharts (Tailwind v4, 响应式, 移动端适配)
- **后端**: Fastify + TypeScript (5 个 API 端点, 异步刷新, 内存缓存)
- **分析引擎**: 纯函数, 8 个测试覆盖, 支持空输入/单条/批量

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

### 配置 AdGuardHome 连接

启动后打开 `http://localhost:5173/`，点击工具栏的 ⚙️ 齿轮图标，填入：

| 字段 | 值 |
|------|-----|
| 地址 | `http://192.168.8.97`（你的 AdGuardHome 内网地址） |
| 用户名 | AdGuardHome 管理员用户名 |
| 密码 | AdGuardHome 管理员密码 |

保存后点击"刷新"即可拉取数据。

### 禁用 SSL 验证（自签名证书）

参见 [SSL 证书说明](docs/SSL.md)。

## 开发

```bash
# 运行测试
npm test

# 构建
npm run build

# 仅启动后端
npm run dev -w @adgh/server

# 仅启动前端
npm run dev -w client
```

## 项目结构

```
adguard-dns-latency/
├── shared/                        # 前后端共享类型
│   └── types.ts
├── packages/
│   ├── server/                    # Fastify 后端
│   │   └── src/
│   │       ├── analyze.ts         # 分析引擎（深模块）
│   │       ├── app.ts             # Fastify 应用 + API
│   │       ├── index.ts           # 入口
│   │       └── adguard/
│   │           ├── client.ts      # AdGuardHome API 客户端
│   │           └── fetcher.ts     # 数据拉取编排
│   └── client/                    # React 前端
│       └── src/
│           ├── components/        # UI 组件（仪表盘 / 表格 / 图表 / 配置面板）
│           ├── hooks/             # 主题 + 数据拉取
│           └── lib/               # 类型定义 + CSV 导出
├── docs/
│   └── SSL.md                     # SSL 证书处理说明
├── .env.example                   # 环境变量模板
└── .gitignore
```

## 测试覆盖

| 模块 | 测试数 |
|------|--------|
| 分析引擎（百分位/缓存/慢查询率） | 8 |
| AdGuardHome 客户端（mock server） | 3 |
| 数据拉取编排（mock server） | 1 |
| API 端点（Fastify inject） | 7 |
| **合计** | **19** |
