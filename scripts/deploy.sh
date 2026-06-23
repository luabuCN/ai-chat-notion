#!/usr/bin/env bash
# 在 VPS 上执行：拉代码 → 顺序构建 → 重启 → 清理悬空镜像
# 用法: ./scripts/deploy.sh [branch]
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"

BRANCH="${1:-main}"

# git pull 会更新本脚本；必须 pull 后重新 exec，否则仍在跑旧版 deploy.sh
if [ "${DEPLOY_UPDATED:-}" != "1" ]; then
  echo "==> Pull latest code (branch: ${BRANCH})"
  git fetch origin "${BRANCH}"
  git reset --hard "origin/${BRANCH}"
  export DEPLOY_UPDATED=1
  exec "$0" "$@"
fi

export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
export IMAGE_TAG="${IMAGE_TAG:-$(TZ="${TZ:-Asia/Shanghai}" date +%Y%m%d-%H%M%S)}"

echo "==> Deploy ${DEPLOY_DIR} (branch: ${BRANCH}, image tag: ${IMAGE_TAG})"

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

echo "==> Build server (COMPOSE_PARALLEL_LIMIT=${COMPOSE_PARALLEL_LIMIT})"
docker compose build --pull server

echo "==> Build web"
docker compose build web

echo "==> Restart containers"
docker compose up -d --remove-orphans

echo "==> Remove old project images (keep ${IMAGE_TAG})"
for repo in ai-chat-notion-server ai-chat-notion-web; do
  docker images "$repo" --format '{{.Repository}}:{{.Tag}}' | while IFS= read -r img; do
    tag="${img#*:}"
    if [ "$tag" != "$IMAGE_TAG" ]; then
      docker rmi "$img" 2>/dev/null || true
    fi
  done
done

echo "==> Remove dangling images"
docker image prune -f

echo "==> Prune stale build cache"
docker builder prune -f --filter "until=24h" 2>/dev/null || docker builder prune -f

echo "==> Done"
docker compose ps
