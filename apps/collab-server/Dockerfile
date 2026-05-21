FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

# 安装 pnpm（corepack 固定走 npmjs.org，国内网络改用 npm 镜像）
RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

# 复制 workspace 配置文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/collab-server/package.json ./apps/collab-server/

# 构建阶段需要 devDependencies（如 prisma CLI）
ENV NODE_ENV=development
RUN pnpm install --frozen-lockfile

# 复制源码后重新 install，修复 workspace 包 node_modules 链接
COPY packages/database ./packages/database
COPY apps/collab-server ./apps/collab-server
RUN pnpm install --frozen-lockfile

# 生成 Prisma client
RUN pnpm --filter @repo/database exec prisma generate

# 构建 collab server
RUN cd apps/collab-server && pnpm build

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 复制 pnpm store（根 node_modules 含 .pnpm 虚拟存储）
COPY --from=base /app/node_modules ./node_modules
# 复制 collab-server 的 node_modules 符号链接（指向 .pnpm store）
COPY --from=base /app/apps/collab-server/node_modules ./apps/collab-server/node_modules

# 复制构建产物和 package.json（保持相同的相对路径以匹配符号链接）
COPY --from=base /app/apps/collab-server/dist ./apps/collab-server/dist
COPY --from=base /app/apps/collab-server/package.json ./apps/collab-server/

# 复制 workspace 依赖
COPY --from=base /app/packages/database ./packages/database

ENV NODE_ENV=production
ENV COLLAB_SERVER_PORT=1234
ENV TZ=Asia/Shanghai

EXPOSE 1234

CMD ["node", "apps/collab-server/dist/index.js"]