#!/usr/bin/env bash
# 在 VPS 上执行：拉代码 → 顺序构建 → 重启 → 清理悬空镜像
# 用法: ./scripts/deploy.sh [branch]
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DEPLOY_DIR"

BRANCH="${1:-main}"

sync_repo() {
  echo "==> Sync git (branch: ${BRANCH})"
  # 解除 single-branch 克隆限制，否则 fetch 其他分支可能失败
  git remote set-branches origin '*' 2>/dev/null || true
  git fetch origin "${BRANCH}" --force --prune
  if ! git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
    echo "ERROR: origin/${BRANCH} not found — push the branch or check remote URL" >&2
    exit 1
  fi
  # 显式 checkout 目标分支，避免仍在旧分支上 reset 导致代码与分支名不一致
  git checkout -B "${BRANCH}" "origin/${BRANCH}"
  echo "==> Git HEAD: $(git branch --show-current) @ $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"
}

# 第一次 sync 后 exec，确保后续执行的是刚拉下来的 deploy.sh
if [ "${DEPLOY_UPDATED:-}" != "1" ]; then
  sync_repo
  export DEPLOY_UPDATED=1
  exec env DEPLOY_UPDATED=1 "$0" "$@"
fi

# exec 后再次 sync，确保构建用的是目标分支最新 commit
sync_repo

export COMPOSE_PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-1}"
export IMAGE_TAG="${IMAGE_TAG:-$(TZ="${TZ:-Asia/Shanghai}" date +%Y%m%d-%H%M%S)}"
# Docker 容器名只允许 [a-zA-Z0-9][a-zA-Z0-9_.-]*；feature/foo → feature-foo
DEPLOY_BRANCH_SLUG="$(
  echo "$BRANCH" |
    tr '[:upper:]' '[:lower:]' |
    tr '/ ' '-' |
    sed 's/[^a-z0-9._-]//g' |
    sed 's/--*/-/g' |
    sed 's/^[.-]*//;s/[.-]*$//' |
    cut -c1-63
)"
if [ -z "$DEPLOY_BRANCH_SLUG" ]; then
  DEPLOY_BRANCH_SLUG="local"
fi
export DEPLOY_BRANCH_SLUG

echo "==> Deploy ${DEPLOY_DIR} (branch: ${BRANCH}, slug: ${DEPLOY_BRANCH_SLUG}, image tag: ${IMAGE_TAG})"

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
