# ============================================
# Build stage — compile server + build client
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY shared/package.json shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install ALL workspace dependencies (including dev: tsc / vite / tailwind are needed to build)
RUN npm ci --include-workspace-root --workspace=@adgh/server --workspace=@adgh/dashboard

# Copy source code
COPY shared/ shared/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/

# Build server (tsc -> packages/server/dist/)
RUN npm run build -w @adgh/server

# Build client (vite -> packages/client/dist/)
RUN npm run build -w @adgh/dashboard

# ============================================
# Runtime deps stage — 只装运行期依赖
# ============================================
FROM node:22-alpine AS runtime-deps

WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# --omit=dev 把 typescript / vite / vitest / oxlint / jsdom 这类构建期依赖挡在镜像外；
# 只装 @adgh/server 这个 workspace，客户端在运行期只提供已构建好的静态文件。
RUN npm ci --omit=dev --include-workspace-root --workspace=@adgh/server

# ============================================
# Production stage
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3080

# 运行期 node_modules（只有 server 的生产依赖和根 workspace 自己的生产依赖）
COPY --from=runtime-deps /app/node_modules/ node_modules/

# Copy built server
COPY --from=builder /app/packages/server/dist/ packages/server/dist/

# Copy built client (served as static files by Fastify)
COPY --from=builder /app/packages/client/dist/ packages/client/dist/

# 模块类型和版本号都靠这几个 package.json：
#   packages/server/package.json 的 "type": "module" 决定 dist/*.js 按 ESM 加载，不再依赖 Node 的语法探测兜底；
#   packages/client/package.json 是 GET /api/health 读版本号的唯一来源，缺了会回落到 unknown。
COPY package.json ./
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY shared/package.json shared/

EXPOSE 3080

CMD ["node", "packages/server/dist/index.js"]