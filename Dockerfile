# ============================================
# Build stage
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY shared/package.json shared/
COPY packages/server/package.json packages/server/

# Install ALL workspace dependencies (server + shared)
RUN npm ci --include-workspace-root --workspace=@adgh/server

# Copy source code
COPY shared/ shared/
COPY packages/server/ packages/server/

# Build server (tsc -> dist/)
RUN npm run build -w @adgh/server

# Prune devDependencies for production
RUN npm prune --include-workspace-root --workspace=@adgh/server --production

# ============================================
# Production stage
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3080

# Copy only what's needed at runtime
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/server/dist/ packages/server/dist/
COPY --from=builder /app/packages/server/node_modules/ packages/server/node_modules/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/shared/ shared/

EXPOSE 3080

CMD ["node", "packages/server/dist/index.js"]
