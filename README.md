# 知作（ai-chat-notion）

知作是一款面向团队的 **AI 文档协作平台**，集智能对话、富文本编辑、多人实时协同、图片生成与浏览器扩展于一体。用户可在工作空间内与 AI 协作创作，在 Notion 风格的编辑器中沉淀知识，并通过 Chrome 扩展在任意网页上调用 AI 能力。

---

## 功能概览

### AI 灵感助手

- 基于 [Vercel AI SDK](https://sdk.vercel.ai/) 的流式对话，支持多模型切换与推理模式
- Agent 工具调用：创建/更新文档、查看文档、请求修改建议、查询天气等
- 对话历史按工作空间隔离，支持标题自动生成与消息投票
- 支持 Artifact 产物（文本、代码、表格等）在侧边栏实时预览与编辑

### 智能文档编辑器

- 基于 [Tiptap 3](https://tiptap.dev/) 的块级富文本编辑器，支持：
  - 标题、列表、任务列表、引用、代码块（语法高亮）
  - 表格、图片、附件、YouTube 嵌入
  - 数学公式（KaTeX）、Mermaid 图表、Chart.js 图表
  - Markdown 粘贴、全文搜索替换、目录导航
  - 斜杠命令（`/`）快速插入块
- 内置 **AI 写作面板**：选区续写、润色、翻译等
- **评论系统**：块级边距评论触发器，支持协作讨论
- **PDF 导入**：解析 PDF 并转为可编辑文档
- **文档层级**：支持父子文档嵌套、收藏、回收站

### 多人实时协同

- 基于 [Yjs CRDT](https://yjs.dev/) + [Hocuspocus](https://tiptap.dev/hocuspocus) 的 WebSocket 协同编辑
- 实时光标与选区同步、在线用户列表
- JWT 身份验证与文档级权限校验
- PostgreSQL 持久化 `yjsState`，断线自动重连

### 文档分享与权限

- **只读发布**：开启后通过 `/preview/[documentId]` 公开查看
- **公开协作**：开启后通过 `/public-doc/[token]` 允许匿名编辑
- **协作者邀请**：按邮箱邀请，支持 view / edit 权限
- **与我共享**：侧边栏展示被邀请的协作文档

### AI 创作工坊

- 接入 ModelScope 推理 API，支持文生图与图生图
- 多模型可选（Z-Image-Turbo、Flux 1、Majicflux v1 等）
- 多种画幅比例、提示词库（风格/场景/光影/镜头等）
- 生成历史按工作空间与用户归档

### 工作空间

- 多工作空间隔离，每个空间独立 slug 路由（如 `/{slug}/chat`）
- 成员管理：角色（owner / member）与权限（view / edit）
- 邀请链接与邮箱邀请
- 新用户 Onboarding 流程（GitHub OAuth 或邮箱注册）

### 浏览器扩展（知作）

基于 [WXT](https://wxt.dev/) 构建的 Chrome 扩展，与主站账号同步：

- **侧边栏 AI 对话**：复用主站 Chat API，支持模型选择与推理模式
- **划词工具栏**：翻译、AI 问答、高亮标注
- **图片工具栏**：OCR 文字提取（Tesseract.js）
- **网页剪藏**：Readability 提取正文并保存至工作空间文档
- **页面摘要**：一键总结当前页面内容

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Monorepo (pnpm + Turbo)                  │
├──────────────┬──────────────────┬───────────────────────────────┤
│  apps/web    │ apps/collab-server│      apps/extensions          │
│  Next.js 15  │  Hocuspocus WS    │      WXT Chrome Extension     │
│  Port 3000   │  Port 1234        │      Port 8088 (dev)          │
└──────┬───────┴────────┬─────────┴───────────────┬───────────────┘
       │                │                         │
       ▼                ▼                         │ (HTTP Proxy)
┌──────────────┐  ┌──────────────┐                 │
│ packages/    │  │ packages/    │                 │
│ database     │  │ editor       │◄────────────────┘
│ (Prisma)     │  │ (Tiptap)     │
├──────────────┤  ├──────────────┤
│ packages/ai  │  │ packages/ui  │
│ (AI SDK)     │  │ (Radix UI)   │
└──────┬───────┘  └──────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  PostgreSQL  │  Redis (可选)         │
│  UploadThing │  Moonshot / ModelScope│
└──────────────────────────────────────┘
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router)、React 19 RC |
| 语言 | TypeScript 5.6 |
| 包管理 | pnpm 9 + Turborepo |
| 数据库 | PostgreSQL + Prisma 6 |
| 认证 | NextAuth v5（GitHub OAuth、邮箱密码、JWT Session） |
| AI | Vercel AI SDK 6、Moonshot AI、ModelScope Inference |
| 编辑器 | Tiptap 3、ProseMirror、Yjs、Hocuspocus |
| UI | Radix UI、Tailwind CSS 4、Framer Motion |
| 文件存储 | UploadThing、Vercel Blob |
| 扩展 | WXT 0.20、Dexie（本地 IndexedDB） |
| 代码质量 | Ultracite / Biome |

---

## 项目结构

```
ai-chat-notion/
├── apps/
│   ├── web/                 # Next.js 主站应用
│   │   ├── app/             # App Router 页面与 API 路由
│   │   ├── components/      # React 组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   └── lib/             # 工具函数、AI 工具、认证等
│   ├── collab-server/       # Hocuspocus 协同编辑 WebSocket 服务
│   └── extensions/          # WXT 浏览器扩展
├── packages/
│   ├── ai/                  # AI 模型、Prompt、Provider 封装
│   ├── database/            # Prisma Schema 与数据访问层
│   ├── editor/              # 统一 Tiptap 编辑器组件
│   └── ui/                  # 共享 UI 组件库
├── .env.example             # 环境变量模板
├── turbo.json               # Turborepo 任务配置
└── pnpm-workspace.yaml      # pnpm 工作区配置
```

---

## 环境要求

- **Node.js** ≥ 18
- **pnpm** 9.12.3（项目通过 `packageManager` 字段锁定版本）
- **PostgreSQL** 数据库
- **Redis**（可选，协同服务多实例部署时使用）
- **Chrome** 浏览器（开发扩展时需要）

---

## 快速开始

### 1. 克隆并安装依赖

```bash
git clone <repository-url>
cd ai-chat-notion
pnpm install
```

### 2. 配置环境变量

复制环境变量模板并填写：

```bash
cp .env.example .env.local
```

详见下方 [环境变量说明](#环境变量说明)。

### 3. 初始化数据库

```bash
# 生成 Prisma Client
pnpm db:generate

# 推送 Schema 到数据库（开发环境）
pnpm db:push
```

### 4. 启动开发服务

**仅 Web 应用：**

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

**Web + 协同编辑（推荐）：**

```bash
pnpm dev:all
```

- Web：`http://localhost:3000`
- Collab Server：`ws://localhost:1234`

**浏览器扩展：**

```bash
pnpm dev:extension
```

扩展开发服务器运行在 `http://localhost:8088`，在 Chrome 中加载 WXT 输出的 `.output/chrome-mv3` 目录。

---

## 环境变量说明

所有应用共享根目录 `.env.local` 配置文件。

### 必需

| 变量 | 说明 |
|------|------|
| `AUTH_SECRET` | NextAuth JWT 签名密钥。生成方式：`openssl rand -base64 32` |
| `POSTGRES_URL` | PostgreSQL 连接字符串 |
| `API_KEY` | Moonshot AI API Key（对话模型，[月之暗面开放平台](https://platform.moonshot.cn/)） |
| `UPLOADTHING_SECRET` | [UploadThing](https://uploadthing.com/) 文件上传 Secret |
| `UPLOADTHING_APP_ID` | UploadThing App ID |

### AI 与图片生成

| 变量 | 说明 |
|------|------|
| `MODELSCOPE_API_KEY` | [ModelScope](https://modelscope.cn/) 推理 API Key，用于 AI 创作工坊文生图 |

### 协同编辑

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | 前端 WebSocket 地址 | `ws://localhost:1234` |
| `COLLAB_SERVER_PORT` | 协同服务端口 | `1234` |
| `REDIS_URL` | Redis 连接（多实例协同同步） | — |

### 认证

| 变量 | 说明 |
|------|------|
| `AUTH_GITHUB_ID` | GitHub OAuth App Client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Client Secret |
| `SMTP_USER` | 邮件发送账号（如 QQ 邮箱） |
| `SMTP_PASS` | 邮箱 SMTP 授权码（非登录密码） |

### 浏览器扩展

在 `apps/extensions/.env` 或根目录配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `WXT_WEB_ORIGIN` | 主站地址，扩展通过此地址代理 API | `http://localhost:3000` |

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Web 开发服务器 |
| `pnpm dev:collab` | 启动协同编辑 WebSocket 服务 |
| `pnpm dev:all` | 同时启动 Web 与 Collab Server |
| `pnpm dev:extension` | 启动浏览器扩展开发模式 |
| `pnpm build` | 构建所有应用 |
| `pnpm lint` | 运行 Ultracite / Biome 代码检查 |
| `pnpm format` | 自动格式化代码 |
| `pnpm db:generate` | 生成 Prisma Client |
| `pnpm db:push` | 推送 Schema 到数据库 |
| `pnpm db:studio` | 打开 Prisma Studio 数据库管理界面 |

---

## 协同编辑服务

协同编辑基于独立的 Hocuspocus WebSocket 服务，详细文档见 [`apps/collab-server/README.md`](apps/collab-server/README.md)。

### 连接流程

1. 前端调用 `POST /api/collab/token` 获取 JWT Token
2. 使用 Token 连接 `NEXT_PUBLIC_HOCUSPOCUS_URL` 指定的 WebSocket 地址
3. 服务端验证 Token 与文档访问权限后开始协同同步

### 生产部署注意

- WebSocket 负载均衡需配置 **Sticky Sessions**
- 多实例部署建议启用 `REDIS_URL` 进行文档状态同步
- Token 默认有效期 24 小时

---

## 主要 API 路由

| 路径 | 说明 |
|------|------|
| `POST /api/chat` | AI 对话（流式） |
| `GET /api/chat/[id]` | 获取对话详情 |
| `POST /api/collab/token` | 获取协同编辑 JWT |
| `GET/POST /api/editor-documents` | 文档 CRUD |
| `POST /api/editor-documents/[id]/publish` | 发布/取消发布文档 |
| `POST /api/editor-documents/[id]/collaborators` | 管理协作者 |
| `POST /api/image/generations` | 创建图片生成任务 |
| `GET /api/image/tasks/[id]` | 查询生成任务状态 |
| `POST /api/pdf/parse` | PDF 解析导入 |
| `GET/POST /api/workspaces` | 工作空间管理 |
| `POST /api/files/upload` | 文件上传 |
| `GET /api/extension/auth-status` | 扩展认证状态同步 |

---

## 数据库模型

核心数据模型（完整 Schema 见 `packages/database/prisma/schema.prisma`）：

| 模型 | 说明 |
|------|------|
| `User` | 用户账号 |
| `Workspace` | 工作空间 |
| `WorkspaceMember` | 空间成员与权限 |
| `Chat` / `Message` | AI 对话与消息 |
| `EditorDocument` | 编辑器文档（含 `yjsState` 协同状态） |
| `DocumentCollaborator` | 文档协作者邀请 |
| `ImageGeneration` | 图片生成记录 |
| `Suggestion` | AI 文档修改建议 |

---

## 浏览器扩展开发

1. 确保主站已启动（`pnpm dev` 或 `pnpm dev:all`）
2. 在 `apps/extensions/.env` 中设置 `WXT_WEB_ORIGIN=http://localhost:3000`
3. 运行 `pnpm dev:extension`
4. 在 Chrome 打开 `chrome://extensions`，开启开发者模式，加载 `.output/chrome-mv3`

扩展通过 Content Script 与 Background Service Worker 代理主站 API，复用 Cookie 实现登录态同步。

---

## 部署

### Web 应用

适用于 [Vercel](https://vercel.com/) 等平台：

```bash
pnpm build
```

确保配置所有必需环境变量，并将 `NEXT_PUBLIC_HOCUSPOCUS_URL` 指向生产环境的 WebSocket 地址（如 `wss://your-domain.com/collab`）。

### Collab Server

支持 Docker 部署：

```bash
cd apps/collab-server
docker build -t collab-server .
docker run -p 1234:1234 \
  -e POSTGRES_URL=your-database-url \
  -e AUTH_SECRET=your-secret \
  collab-server
```

---

## 开发规范

- 代码风格由 [Ultracite](https://github.com/haydenbleasel/ultracite)（Biome）强制执行
- 提交前运行 `pnpm lint` 与 `pnpm format`
- 共享包通过 `workspace:*` 协议引用，修改 packages 后无需额外 publish

---

## 许可证

本项目基于 [Apache License 2.0](LICENSE) 开源。
