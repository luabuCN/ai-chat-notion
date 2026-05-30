#!/bin/sh
set -e

if [ -n "${POSTGRES_URL:-}" ]; then
  cd /app/packages/database
  npx prisma migrate deploy
fi

exec "$@"
