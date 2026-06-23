#!/usr/bin/env bash
# 在 VPS 上执行：拉代码 → 顺序构建 → 重启 → 清理悬空镜像
# 用法: ./scripts/deploy.sh [branch]
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"

BRANCH="${1:-main}"
export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"

echo "==> Deploy ${DEPLOY_DIR} (branch: ${BRANCH})"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin not found" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: .env not found — copy dokploy.env.example and configure secrets" >&2
  exit 1
fi

echo "==> Pull latest code"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "==> Build server (COMPOSE_PARALLEL_LIMIT=${COMPOSE_PARALLEL_LIMIT})"
docker compose build --pull server

echo "==> Build web"
docker compose build web

echo "==> Restart containers"
docker compose up -d --remove-orphans

echo "==> Remove dangling images"
docker image prune -f

echo "==> Prune stale build cache"
docker builder prune -f --filter "until=24h" 2>/dev/null || docker builder prune -f

echo "==> Done"
docker compose ps
