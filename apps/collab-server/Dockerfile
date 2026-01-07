FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/database/package.json ./packages/database/
COPY apps/collab-server/package.json ./apps/collab-server/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/database ./packages/database
COPY apps/collab-server ./apps/collab-server

# Generate Prisma client
RUN cd packages/database && pnpm prisma generate

# Build the collab server
RUN cd apps/collab-server && pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy built files
COPY --from=base /app/apps/collab-server/dist ./dist
COPY --from=base /app/apps/collab-server/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/database ./packages/database

ENV NODE_ENV=production
ENV COLLAB_SERVER_PORT=1234

EXPOSE 1234

CMD ["node", "dist/index.js"]

