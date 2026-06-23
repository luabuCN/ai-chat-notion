#!/bin/sh
set -e

if [ -n "${POSTGRES_URL:-}" ]; then
  # Use the Prisma CLI bundled at build time (v6). Bare `npx prisma` resolves to v7+ and breaks schema validation.
  PRISMA_BIN="/app/node_modules/.pnpm/node_modules/.bin/prisma"
  SCHEMA=/app/packages/database/prisma/schema.prisma
  DB_PUSH_FLAGS="--skip-generate"
  if [ "${PRISMA_ACCEPT_DATA_LOSS:-}" = "true" ]; then
    DB_PUSH_FLAGS="$DB_PUSH_FLAGS --accept-data-loss"
  fi
  # Sync full schema.prisma to DB on every deploy (same as local `pnpm db:push`).
  "$PRISMA_BIN" db push --schema="$SCHEMA" $DB_PUSH_FLAGS
fi

exec "$@"
