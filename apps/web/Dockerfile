FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/editor/package.json ./packages/editor/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

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

ENV NODE_ENV=production
RUN pnpm build --filter=@repo/web

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
