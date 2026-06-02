#!/bin/sh
set -e

if [ -n "${POSTGRES_URL:-}" ]; then
  # Use the Prisma CLI bundled at build time (v6). Bare `npx prisma` resolves to v7+ and breaks schema validation.
  PRISMA_BIN="/app/node_modules/.pnpm/node_modules/.bin/prisma"
  "$PRISMA_BIN" migrate deploy --schema=/app/packages/database/prisma/schema.prisma
fi

exec "$@"
