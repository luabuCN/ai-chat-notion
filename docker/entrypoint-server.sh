#!/bin/sh
set -e

resolve_prisma_bin() {
  if [ -x /app/node_modules/.bin/prisma ]; then
    printf '%s\n' /app/node_modules/.bin/prisma
    return 0
  fi

  hoisted_bin="$(find /app/node_modules -path '*/.bin/prisma' -type f 2>/dev/null | head -1)"
  if [ -n "$hoisted_bin" ] && [ -x "$hoisted_bin" ]; then
    printf '%s\n' "$hoisted_bin"
    return 0
  fi

  prisma_js="$(find /app/node_modules -path '*/prisma/build/index.js' -type f 2>/dev/null | head -1)"
  if [ -n "$prisma_js" ]; then
    printf 'node %s\n' "$prisma_js"
    return 0
  fi

  return 1
}

if [ -n "${POSTGRES_URL:-}" ]; then
  # Use the Prisma CLI bundled at build time (v6). Bare `npx prisma` resolves to v7+ and breaks schema validation.
  PRISMA_BIN="$(resolve_prisma_bin || true)"
  SCHEMA=/app/packages/database/prisma/schema.prisma
  DB_PUSH_FLAGS="--skip-generate"
  if [ "${PRISMA_ACCEPT_DATA_LOSS:-}" = "true" ]; then
    DB_PUSH_FLAGS="$DB_PUSH_FLAGS --accept-data-loss"
  fi

  if [ -z "$PRISMA_BIN" ]; then
    echo "entrypoint: prisma CLI not found under /app/node_modules — skip db push" >&2
  else
    # Sync full schema.prisma to DB on every deploy (same as local `pnpm db:push`).
    # shellcheck disable=SC2086
    $PRISMA_BIN db push --schema="$SCHEMA" $DB_PUSH_FLAGS
  fi
fi

exec "$@"
