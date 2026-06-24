#!/usr/bin/env bash
# 在 VPS 上执行：拉代码 → 顺序构建 → 重启 → 清理悬空镜像
# 用法: ./scripts/deploy.sh [branch]
#
# 多环境并行（dev + master 同时运行）：
#   - dev    → .env，Compose 项目 ai-chat-notion-dev，默认端口 web 8080 / server 4000
#   - master → .env.test，Compose 项目 ai-chat-notion-master，默认端口 web 3000 / server 5000
#   两套容器通过 COMPOSE_PROJECT_NAME 隔离网络，镜像 tag 默认与分支 slug 一致
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

# 按分支选择 env 文件、Compose 项目名（允许环境变量覆盖）
case "$DEPLOY_BRANCH_SLUG" in
  dev)
    ENV_FILE="${ENV_FILE:-.env}"
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-chat-notion-dev}"
    ;;
  master | main)
    ENV_FILE="${ENV_FILE:-.env.test}"
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-chat-notion-master}"
    ;;
  *)
    ENV_FILE="${ENV_FILE:-.env}"
    COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-chat-notion-${DEPLOY_BRANCH_SLUG}}"
    ;;
esac
export ENV_FILE
export COMPOSE_ENV_FILE="$ENV_FILE"
export COMPOSE_PROJECT_NAME
# 默认用分支 slug 作为镜像 tag，避免 dev/master 互相覆盖
export IMAGE_TAG="${IMAGE_TAG:-$DEPLOY_BRANCH_SLUG}"

compose() {
  docker compose --env-file "$ENV_FILE" -p "$COMPOSE_PROJECT_NAME" "$@"
}

echo "==> Deploy ${DEPLOY_DIR}"
echo "    branch: ${BRANCH}"
echo "    slug: ${DEPLOY_BRANCH_SLUG}"
echo "    env file: ${ENV_FILE}"
echo "    compose project: ${COMPOSE_PROJECT_NAME}"
echo "    image tag: ${IMAGE_TAG}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin not found" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: ${ENV_FILE} not found — copy dokploy.env.example (dev) or .env.test.example (master)" >&2
  exit 1
fi

echo "==> Build server (COMPOSE_PARALLEL_LIMIT=${COMPOSE_PARALLEL_LIMIT})"
compose build --pull server

echo "==> Build web"
compose build web

echo "==> Restart containers"
compose up -d --remove-orphans

echo "==> Remove old images for ${COMPOSE_PROJECT_NAME} (keep tag ${IMAGE_TAG})"
for repo in ai-chat-notion-server ai-chat-notion-web; do
  docker images "$repo" --format '{{.Repository}}:{{.Tag}}' | while IFS= read -r img; do
    tag="${img#*:}"
    if [ "$tag" = "$IMAGE_TAG" ]; then
      continue
    fi
    # 只清理同分支的历史 tag（形如 dev-20250624-120000），不影响另一套环境
    case "$tag" in
      "${DEPLOY_BRANCH_SLUG}" | "${DEPLOY_BRANCH_SLUG}"-*)
        docker rmi "$img" 2>/dev/null || true
        ;;
    esac
  done
done

echo "==> Remove dangling images"
docker image prune -f

echo "==> Prune stale build cache"
docker builder prune -f --filter "until=24h" 2>/dev/null || docker builder prune -f

echo "==> Done (${COMPOSE_PROJECT_NAME})"
compose ps
