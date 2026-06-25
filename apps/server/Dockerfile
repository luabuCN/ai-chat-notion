# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmjs.org
ARG PRISMA_ENGINES_MIRROR=
ENV npm_config_registry=${NPM_REGISTRY}
ENV PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}
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

COPY .npmrc pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/
COPY apps/server/package.json ./apps/server/

ENV NODE_ENV=development
RUN --mount=type=cache,id=pnpm-store-server-dev,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

COPY packages/database ./packages/database
COPY packages/ai ./packages/ai
COPY apps/server ./apps/server

RUN pnpm --filter @repo/database exec prisma generate \
  && mkdir -p /prisma-artifacts \
  && if [ -d node_modules/.prisma ]; then \
       cp -a node_modules/.prisma /prisma-artifacts/; \
     else \
       PRISMA_DIR="$(find /app/node_modules -path '*/node_modules/.prisma' -type d | head -1)" \
       && cp -a "$PRISMA_DIR" /prisma-artifacts/.prisma; \
     fi
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/ai build
RUN pnpm --filter @repo/server exec tsc --skipLibCheck

FROM node:20-alpine AS production

ARG NPM_REGISTRY=https://registry.npmjs.org
ENV npm_config_registry=${NPM_REGISTRY}
ENV npm_config_fetch_retries=10
ENV npm_config_fetch_retry_mintimeout=20000
ENV npm_config_fetch_retry_maxtimeout=120000
ENV npm_config_fetch_timeout=300000
ENV npm_config_network_concurrency=4

RUN npm config set registry ${NPM_REGISTRY} \
  && npm install -g pnpm@9.12.3 \
  && npm cache clean --force

WORKDIR /app

COPY .npmrc pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/
COPY apps/server/package.json ./apps/server/

ENV NODE_ENV=production
RUN --mount=type=cache,id=pnpm-store-server-prod,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @repo/server...

COPY --from=base /app/packages/database/prisma ./packages/database/prisma
COPY --from=base /app/packages/database/dist ./packages/database/dist
COPY --from=base /app/packages/database/package.json ./packages/database/
COPY --from=base /app/packages/ai/dist ./packages/ai/dist
COPY --from=base /app/packages/ai/package.json ./packages/ai/
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/

# Reuse Prisma Client from the build stage — avoids a second download from binaries.prisma.sh.
COPY --from=base /prisma-artifacts/.prisma ./node_modules/.prisma
RUN pnpm store prune \
  && rm -rf /root/.cache /root/.npm /root/.local/share/pnpm/store

COPY docker/entrypoint-server.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV SERVER_HTTP_PORT=4000
ENV TZ=Asia/Shanghai

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/server/dist/index.js"]
