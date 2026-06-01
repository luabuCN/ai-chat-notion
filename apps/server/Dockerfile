FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.json ./
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
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/ai build
RUN cd apps/server && npx tsc --skipLibCheck

FROM node:20-alpine AS production

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

# 复制 package 文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/
COPY apps/server/package.json ./apps/server/

# 只安装生产依赖
ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod

# 复制构建产物和必要文件
COPY --from=base /app/packages/database/prisma ./packages/database/prisma
COPY --from=base /app/packages/database/dist ./packages/database/dist
COPY --from=base /app/packages/database/package.json ./packages/database/
COPY --from=base /app/packages/ai/dist ./packages/ai/dist
COPY --from=base /app/packages/ai/package.json ./packages/ai/
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/
# 复制 node_modules（包含生成的 Prisma Client）
COPY --from=base /app/node_modules ./node_modules

COPY docker/entrypoint-server.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV SERVER_HTTP_PORT=4000
ENV TZ=Asia/Shanghai

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/server/dist/index.js"]
