# ============================================
# Build stage — compile server + build client
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY shared/package.json shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install ALL workspace dependencies
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
# Production stage
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3080

# Copy hoisted node_modules from root (npm workspaces hoists everything here)
COPY --from=builder /app/node_modules/ node_modules/

# Copy built server
COPY --from=builder /app/packages/server/dist/ packages/server/dist/

# Copy built client (served as static files by Fastify)
COPY --from=builder /app/packages/client/dist/ packages/client/dist/

# Copy package.json for metadata
COPY --from=builder /app/package.json ./

EXPOSE 3080

CMD ["node", "packages/server/dist/index.js"]
