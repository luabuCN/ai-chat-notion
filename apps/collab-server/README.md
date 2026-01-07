# Collab Server

Hocuspocus WebSocket 协同编辑服务器，为 Tiptap 编辑器提供多人实时协同编辑功能。

## 功能特性

- 🚀 基于 Yjs CRDT 的实时协同编辑
- 🔐 JWT Token 身份验证
- 💾 PostgreSQL 持久化存储
- 👥 用户光标和选区实时同步
- 🔄 自动断线重连

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

collab-server 使用根目录的 `.env.local` 配置文件（与 web 应用共享）。

在根目录 `.env.local` 中确保配置：
- `POSTGRES_URL` - 数据库连接字符串
- `AUTH_SECRET` - 认证密钥

可选配置：
- `COLLAB_SERVER_PORT` - 服务端口（默认 1234）

### 3. 运行数据迁移

首次运行前，需要将现有文档转换为 Yjs 格式：

```bash
# 预览迁移（不实际写入）
pnpm migrate:yjs:dry-run

# 执行迁移
pnpm migrate:yjs
```

### 4. 启动开发服务器

```bash
pnpm dev
```

服务器将在 `ws://localhost:1234` 启动。

## 生产部署

### Docker 部署

```bash
docker build -t collab-server .
docker run -p 1234:1234 \
  -e POSTGRES_URL=your-database-url \
  -e AUTH_SECRET=your-secret \
  collab-server
```

### Docker Compose

```yaml
services:
  collab-server:
    build: ./apps/collab-server
    ports:
      - "1234:1234"
    environment:
      - POSTGRES_URL=${POSTGRES_URL}
      - AUTH_SECRET=${AUTH_SECRET}
    depends_on:
      - postgres
```

## API

### WebSocket 连接

连接到 `ws://your-server:1234`，需要提供：

- `name`: 文档 ID（即 `documentId`）
- `token`: JWT Token（通过 `/api/collab/token` 获取）

### 身份验证流程

1. 前端调用 `POST /api/collab/token` 获取 token
2. 使用 token 连接 WebSocket
3. 服务器验证 token 和文档访问权限
4. 验证通过后开始协同编辑

## 配置选项

| 环境变量 | 必需 | 默认值 | 说明 |
|---------|------|--------|------|
| `POSTGRES_URL` | ✅ | - | PostgreSQL 数据库连接字符串 |
| `AUTH_SECRET` | ✅ | - | JWT 签名密钥 |
| `COLLAB_SERVER_PORT` | ❌ | 1234 | WebSocket 服务端口 |
| `NODE_ENV` | ❌ | development | 运行环境 |

## 架构

```
┌─────────────┐     WebSocket      ┌─────────────────┐
│   Browser   │ ←───────────────→  │  Collab Server  │
│  (Tiptap)   │                    │  (Hocuspocus)   │
└─────────────┘                    └────────┬────────┘
                                            │
                                            ↓
                                   ┌─────────────────┐
                                   │   PostgreSQL    │
                                   │  (yjsState)     │
                                   └─────────────────┘
```

## 开发

### 项目结构

```
apps/collab-server/
├── src/
│   ├── index.ts              # 入口文件
│   ├── server.ts             # Hocuspocus 服务器配置
│   ├── auth.ts               # 身份验证逻辑
│   ├── extensions/
│   │   └── database.ts       # 数据库持久化扩展
│   └── scripts/
│       └── migrate-to-yjs.ts # 数据迁移脚本
├── package.json
├── tsconfig.json
└── Dockerfile
```

### 调试

启用详细日志：

```bash
DEBUG=hocuspocus* pnpm dev
```

## 注意事项

1. **WebSocket 负载均衡**：生产环境需要配置 sticky sessions
2. **数据一致性**：`yjsState` 和 `content` 字段都会更新，保持兼容性
3. **Token 有效期**：默认 24 小时，过期后需要重新获取

