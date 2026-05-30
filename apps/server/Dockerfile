FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/
COPY apps/server/package.json ./apps/server/

ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

COPY packages/database ./packages/database
COPY packages/ai ./packages/ai
COPY apps/server ./apps/server
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @repo/database exec prisma generate

RUN cd apps/server && pnpm build

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=base /app/packages/database ./packages/database

COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/

COPY docker/entrypoint-server.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV SERVER_HTTP_PORT=4000
ENV TZ=Asia/Shanghai

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/server/dist/index.js"]
