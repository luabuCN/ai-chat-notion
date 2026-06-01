FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

# 安装 pnpm（corepack 固定走 npmjs.org，国内网络改用 npm 镜像）
RUN npm config set registry ${NPM_REGISTRY} && npm install -g pnpm@9.12.3

WORKDIR /app

# 复制 workspace 配置文件
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ai/package.json ./packages/ai/
COPY packages/database/package.json ./packages/database/
COPY packages/editor/package.json ./packages/editor/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

ENV NODE_ENV=development
# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制所有 packages 源码
COPY packages/ai ./packages/ai
COPY packages/database ./packages/database
COPY packages/editor ./packages/editor
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile

# 生成 Prisma client
RUN pnpm --filter @repo/database exec prisma generate

# 前端公共环境变量（Next.js 在构建时内联 NEXT_PUBLIC_*）
ARG NEXT_PUBLIC_APP_URL=http://localhost:8080
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# 构建时 Prisma 客户端在模块加载阶段即校验 POSTGRES_URL（Collecting page data）
# 此处仅满足 Next.js 构建静态分析，不会真正连接数据库；运行时由 compose 注入真实值
ARG POSTGRES_URL=postgresql://postgres:postgres@postgres:5432/ai_chat_notion
ARG AUTH_SECRET=build-time-placeholder-secret-min-32-chars
ENV POSTGRES_URL=$POSTGRES_URL
ENV AUTH_SECRET=$AUTH_SECRET

# Next.js 生产构建需要 NODE_ENV=production
ENV NODE_ENV=production

# 构建 web 应用（turbo 会处理依赖关系）
RUN pnpm build --filter=@repo/web

# 生产阶段 - 使用 standalone 模式
FROM node:20-alpine AS production

WORKDIR /app

# 复制 standalone 输出（包含 server.js 和最小化依赖）
COPY --from=base /app/apps/web/.next/standalone ./
# 复制静态资源
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static
# 复制 i18n 配置
COPY --from=base /app/apps/web/messages ./apps/web/messages

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
# Next.js standalone 默认只监听 localhost，需要设为 0.0.0.0 才能在容器外访问
ENV HOSTNAME=0.0.0.0
# API 代理目标（Docker 内部通过服务名访问 server 容器）
ENV API_PROXY_URL=http://server:4000

EXPOSE 8080

# standalone 模式使用 server.js 启动
CMD ["node", "apps/web/server.js"]
