FROM node:20-alpine

ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database ./packages/database

ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile --filter @repo/database...

WORKDIR /app

CMD ["pnpm", "--filter", "@repo/database", "exec", "prisma", "migrate", "deploy"]
