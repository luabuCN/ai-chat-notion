FROM node:20-alpine AS base

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

RUN npm config set registry ${NPM_REGISTRY} \
  && npm install -g pnpm@9.12.3 \
  && npm cache clean --force

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

RUN pnpm --filter @repo/database exec prisma generate
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/ai build
RUN pnpm --filter @repo/server exec tsc --skipLibCheck

FROM node:20-alpine AS production

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV npm_config_registry=${NPM_REGISTRY}

# Force sharp to use only linux-x64 platform binaries
ENV npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp"
ENV npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips"
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Install build dependencies needed for native modules (sharp, prisma, etc.)
RUN apk add --no-cache --virtual .build-deps \
  python3 \
  make \
  g++ \
  libc6-compat \
  vips-dev \
  && npm config set registry ${NPM_REGISTRY} \
  && npm install -g pnpm@9.12.3 \
  && npm cache clean --force

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/
COPY apps/server/package.json ./apps/server/

ENV NODE_ENV=production
RUN pnpm install --frozen-lockfile --prod --filter @repo/server... \
  && pnpm store prune

COPY --from=base /app/packages/database/prisma ./packages/database/prisma
COPY --from=base /app/packages/database/dist ./packages/database/dist
COPY --from=base /app/packages/database/package.json ./packages/database/
COPY --from=base /app/packages/ai/dist ./packages/ai/dist
COPY --from=base /app/packages/ai/package.json ./packages/ai/
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/

# Generate Prisma Client from production dependencies
RUN pnpm --filter @repo/database exec prisma generate

# Cleanup: remove build deps, caches, and unnecessary files
RUN apk del .build-deps \
  && rm -rf /root/.cache /root/.npm /root/.local/share/pnpm/store \
  && find /app/node_modules \
    \( -name "*.md" -o -name "*.txt" -o -name "README*" -o -name "CHANGELOG*" \
       -o -name "*.map" -o -name "*.d.ts" -o -name "test" -o -name "tests" \
       -o -name "__tests__" -o -name "example" -o -name "examples" \
       -o -name "benchmark" -o -name "benchmarks" -o -name ".github" \) \
    -type f -delete 2>/dev/null || true \
  && find /app/node_modules \
    \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "example" \
       -o -name "examples" -o -name "benchmark" -o -name "benchmarks" \
       -o -name ".github" \) \
    -type d -exec rm -rf {} + 2>/dev/null || true

COPY docker/entrypoint-server.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV SERVER_HTTP_PORT=4000
ENV TZ=Asia/Shanghai

EXPOSE 4000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/server/dist/index.js"]
