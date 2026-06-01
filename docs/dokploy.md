# Dokploy 部署说明

主配置为仓库根目录 `docker-compose.yml`（仅 **web** + **server**）。Postgres / Redis 请在 Dokploy 中单独创建，或使用 `docker-compose.local.yml` 在本地起全栈。

## 1. 创建 Compose 应用

1. Dokploy → **Docker Compose**，连接本仓库。
2. **Compose path**：`docker-compose.yml`（不要包含 `docker-compose.local.yml`）。
3. **Compose type**：选 **Docker Compose**，不要选 Stack/Swarm。
4. **Provider**：
   - **Branch**：`dev`（或 `master`，与部署环境一致）
   - **Trigger Type**：**On Tag**（不要选 On Push，避免与 GitHub Actions 抢跑）
   - 镜像由 [`.github/workflows/build.yml`](../.github/workflows/build.yml) 构建并推到 GHCR；CI 成功后会推送标签 `deploy/<分支名>`，Dokploy 据此拉取并部署。

部署链路：`push` → Actions 构建推 GHCR → 打 tag `deploy/dev` → Dokploy On Tag 触发 → `compose pull` 重启。

## 2. Environment（必填项示例）

在 **Environment** 编辑器中粘贴并修改（部署时会生成 `.env`，供 `${VAR}` 替换）。可参考仓库根目录 `dokploy.env.example`。

```env
IMAGE_TAG=dev
AUTH_SECRET=替换为 openssl rand -base64 32 的结果
POSTGRES_URL=postgresql://...
REDIS_URL=redis://...
AUTH_TRUST_HOST=true
```

`IMAGE_TAG` 须与 Actions 推送到 GHCR 的分支标签一致（`dev` 或 `master`），不要用 `latest`。

**URL 类变量可不填**，`docker-compose.yml` 已带本地默认端口：

| 变量 | 默认值 |
|------|--------|
| `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` | `http://127.0.0.1:8080` |
| `API_ORIGIN` / `NEXT_PUBLIC_API_ORIGIN` | `http://127.0.0.1:4000` |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | `ws://127.0.0.1:4000/collab` |

以后若上域名，再在 Environment 里覆盖上述变量并重新 Deploy（`NEXT_PUBLIC_*` 会参与 Web 构建）。

说明：

| 变量 | 说明 |
|------|------|
| `POSTGRES_URL` | 完整 URL，优先于 `POSTGRES_USER` 等分项变量 |
| `REDIS_URL` | 完整 URL，优先于 `REDIS_PASSWORD` |
| `NEXT_PUBLIC_*` | 未设置时用上表默认；修改后需 **重新 Deploy** |

## 3. 访问方式（默认端口）

在 Dokploy 为服务暴露宿主机端口（或在 Domains 里映射到容器端口）：

| 服务 | 容器端口 | 默认访问 |
|------|----------|----------|
| `web` | `8080` | `http://<服务器IP>:8080` |
| `server` | `4000` | `http://<服务器IP>:4000`（`/ping` 健康检查） |

协同编辑需能访问 `ws://<服务器IP>:4000/collab`（若经反向代理，再改 `NEXT_PUBLIC_HOCUSPOCUS_URL`）。

## 4. 部署顺序

1. 先确保 Postgres、Redis 已运行，且 `POSTGRES_URL` / `REDIS_URL` 可从 compose 网络访问。
2. Deploy Compose：`server` 启动时会执行 `prisma migrate deploy`（见 `docker/entrypoint-server.sh`）。
3. `web` 在 `server` 健康检查通过后再启动。

## 5. 本地开发

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

访问 `http://127.0.0.1:8080`（可通过 `WEB_PORT` 改宿主机端口）。

## 6. 可选：拆成两个 Application

若不用 Compose、分别部署镜像：

- **server**：Dockerfile `apps/server/Dockerfile`，端口 `4000`，环境变量同上（含 `POSTGRES_URL`）。
- **web**：Dockerfile `apps/web/Dockerfile`，端口 `8080`；构建参数需在 Dokploy 构建配置中传入 `NEXT_PUBLIC_*` 与 `POSTGRES_URL`、`AUTH_SECRET`。

此时需自行保证迁移（server 入口脚本仍会迁移）与 `NEXT_PUBLIC_HOCUSPOCUS_URL` 指向正确的 API 域名。
