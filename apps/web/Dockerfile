# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmjs.org
ENV npm_config_registry=${NPM_REGISTRY}
# 网络重试配置 —— 避免 CDN 偶发超时导致构建失败
ENV npm_config_fetch_retries=10
ENV npm_config_fetch_retry_mintimeout=20000
ENV npm_config_fetch_retry_maxtimeout=120000
ENV npm_config_fetch_timeout=300000
# 降低并发，减轻镜像 CDN 压力（过高易触发 ETIMEDOUT）
ENV npm_config_network_concurrency=4

RUN npm config set registry ${NPM_REGISTRY} \
  && npm install -g pnpm@9.12.3 \
  && npm cache clean --force
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/editor/package.json ./packages/editor/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

ENV NODE_ENV=development
RUN --mount=type=cache,id=pnpm-store-web,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

COPY packages/ai ./packages/ai
COPY packages/database ./packages/database
COPY packages/editor ./packages/editor
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN pnpm --filter @repo/database exec prisma generate

ARG NEXT_PUBLIC_APP_URL=http://localhost:8080
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# NEXT_PUBLIC_* 会在 next build 时写入客户端 bundle，必须在构建时注入（Dokploy 运行时 env 无效）
ARG NEXT_PUBLIC_API_ORIGIN=
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_HOCUSPOCUS_URL=
ENV NEXT_PUBLIC_HOCUSPOCUS_URL=$NEXT_PUBLIC_HOCUSPOCUS_URL

# Build-time placeholders only. Runtime values are injected by compose/Dokploy.
ARG POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/ai_chat_notion
ARG AUTH_SECRET=build-time-placeholder-secret-min-32-chars
ENV POSTGRES_URL=$POSTGRES_URL
ENV AUTH_SECRET=$AUTH_SECRET

# API 代理目标 —— rewrites() 在构建时求值，必须在 build 前注入
ARG API_PROXY_URL=http://server:4000
ENV API_PROXY_URL=$API_PROXY_URL

# 分步构建 workspace 包，避免 turbo 一次性编译导致 OOM（3GB VPS 常见）
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/ai build
RUN pnpm --filter @repo/editor build
RUN pnpm --filter @repo/ui build

# 限制 Node 堆；1536 不够（实测 next build 需 ~2GB 堆），3GB 机器须配 swap
ARG NODE_BUILD_HEAP_MB=2048
ENV DOCKER_BUILD=1
ENV NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_HEAP_MB}"
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_CONCURRENCY=1

# 释放构建前缓存，降低 next build 峰值内存
RUN rm -rf apps/web/.next node_modules/.cache /root/.cache

ENV NODE_ENV=production
RUN pnpm --filter @repo/web exec next build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=base /app/apps/web/.next/standalone ./
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=base /app/apps/web/messages ./apps/web/messages

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
ENV HOSTNAME=0.0.0.0

EXPOSE 8080

CMD ["node", "apps/web/server.js"]
