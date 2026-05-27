# API 与协同服务后端迁移方案

## 当前进度（2026-05-27 更新）

### 已完成

- **阶段 0：Hono 后端骨架**
  - 新增 `apps/server`，目录布局：`src/index.ts`、`src/http/app.ts`、`src/http/middleware/cors.ts`、`src/http/routes/{ai,chat,collab,history,models}/`（见下文「HTTP 路由模块约定」）、`src/shared/{auth,config,errors,permissions,types,utils}.ts`、`src/collab/{server,auth,extensions}.ts`。
  - 根目录 `package.json` 新增 `dev:server`、`dev:all`、`build:server` 等脚本。
  - `turbo.json` 注册 `@repo/server#dev` / `#build`，并显式声明所需环境变量（`SERVER_HTTP_PORT`、`SERVER_COLLAB_PORT`、`WEB_ORIGIN`、`API_ORIGIN`、`NEXT_PUBLIC_API_ORIGIN`、`API_AUTH_SECRET` 等）。
  - HTTP 与 Collab 同进程启动：HTTP `4000`、Collab WebSocket `1234`，提供 `SIGINT/SIGTERM` 优雅关闭。

- **阶段 1：认证、错误、CORS 统一**
  - `apps/server/src/shared/auth.ts`：`getSessionFromRequest` 支持 `Bearer <api-token>`（JWT，密钥 `API_AUTH_SECRET`）与 NextAuth Cookie 两种来源。
  - `apps/server/src/shared/errors.ts`：`ApiError` 统一错误码与响应结构，替换 `ChatSDKError` 的 web-only 依赖。
  - `apps/server/src/http/middleware/cors.ts`：基于 allowlist（`WEB_ORIGIN`、`API_ORIGIN`、`CHROME_EXTENSION_ORIGIN`、`FIREFOX_EXTENSION_ORIGIN`、`WXT_*_ORIGIN`），开发环境放行 `localhost` / `chrome-extension://` / `moz-extension://`。
  - `apps/server/src/shared/permissions.ts`：从 `apps/collab-server/src/document-permission.ts` 收敛 `checkDocumentPermission` 漏斗模型，HTTP `/api/collab/token` 与 Hocuspocus `onAuthenticate`/`onChange` 共用同一份判断。

- **阶段 2：第一批接口迁移到 `apps/server`**
  - 已迁移并对外提供：
    - `POST/DELETE /api/chat`、`GET /api/chat/:id`、`GET /api/chat/:id/messages`、`GET /api/chat/:id/title`、`GET /api/chat/:id/stream`（resumable SSE）
    - `GET/DELETE /api/history`
    - `GET /api/models`
    - `POST /api/collab/token`
    - `POST /api/ai/completion`、`POST /api/ai/openai`
  - `apps/web` 前端已切到统一 `apiUrl/apiFetch/apiJson`：
    - 新增 `apps/web/lib/api-client.ts`（`SERVER_API_PREFIXES` 维护已迁移 path 集合）。
    - 新增 `apps/web/lib/api-types.ts`（`ModelInfo`），不再从 `@/app/api/models/route` 导入类型。
    - 新增 `apps/web/hooks/use-chat-history-query.ts`（React Query 版历史接口 hook）。
    - `components/chat.tsx` 通过 `apiUrl("/api/chat")` 驱动 `DefaultChatTransport`；`fetcher`、`fetchWithErrorHandlers` 已包 `apiFetch`，所有 `/api/history`、`/api/chat?id=...` 等相对路径自动转发到 `apps/server`。
    - `hooks/use-models.ts`、`hooks/use-collab-token.ts`、`components/message-actions.tsx`、`components/image/actions.ts`、`components/multimodal-input.tsx`、`components/sidebar-history.tsx` 已切换。
  - 浏览器插件 (`apps/extensions`) 已新增 `API_ORIGIN`（`WXT_API_ORIGIN`），并切换 `models`、`chat`（sidepanel transport）、主站 API fetch、`ai/openai` 流式后台调用到新源；同时为后续 token 化迁移做好分离。
  - 已删除 `apps/web/app/api/{chat,history,models,collab,ai/completion,ai/openai}/` 目录与所有内部 `withExtensionCors`/`OPTIONS` 分支。

- **HTTP 路由模块分层（2026-05-27）**
  - 第一批已迁移的 5 个 route 从单文件改为「一模块一目录」，统一三层职责：
    - `index.ts`：Hono 路由注册，只做 path → handler 绑定
    - `handlers.ts`：鉴权、业务逻辑、组装 `Response`
    - `schema.ts`：Zod 校验 + `z.infer` 类型（无 body/query schema 的模块可省略）
  - 当前目录：

    ```text
    apps/server/src/http/routes/
    ├── ai/
    │   ├── index.ts
    │   ├── handlers.ts      # completionHandler、openaiHandler
    │   └── schema.ts        # completionRequestSchema、openaiRequestSchema
    ├── chat/
    │   ├── index.ts
    │   ├── handlers.ts      # postChatHandler、deleteChatHandler、getChat* 等
    │   └── schema.ts        # postRequestBodySchema（原 chat-schema.ts）
    ├── collab/
    │   ├── index.ts
    │   ├── handlers.ts      # createTokenHandler
    │   └── schema.ts        # collabTokenBodySchema
    ├── history/
    │   ├── index.ts
    │   └── handlers.ts      # listHistoryHandler、deleteAllHistoryHandler
    └── models/
        ├── index.ts
        ├── handlers.ts      # listModelsHandler
        └── schema.ts        # ModelInfo 响应类型
    ```

  - `apps/server/src/http/app.ts` 通过显式路径挂载（NodeNext 不会自动解析目录 index）：

    ```ts
    import { aiRoutes } from "./routes/ai/index.js";
    import { chatRoutes } from "./routes/chat/index.js";
    // ...
    app.route("/api/ai", aiRoutes);
    app.route("/api/chat", chatRoutes);
    ```

  - **后续第二批/第三批迁移的新模块**（如 `workspaces`、`editor-documents`）按同一约定新建目录，不再使用 `routes/foo.ts` 单文件写法。
  - 类型对齐：`ModelInfo` 仍在 `apps/web/lib/api-types.ts` 独立维护；server 侧 `models/schema.ts` 仅作 handler 内部类型，扩展侧见 `apps/extensions/hooks/use-extension-models.ts` 中的 `ExtensionModelInfo` 注释。

### 进行中 / 待办

- **阶段 2 第一批：本地验收**
  - `pnpm dev:all` 同时启动 web (3000) + server (4000) + collab WS (1234)。
  - 冒烟：`/api/models` (Cookie 模式)、`/api/history` 列表/删除、`/api/chat` SSE 首 token、`/api/chat/:id/stream` resumable、`POST /api/collab/token` → Hocuspocus 连接。
  - 浏览器插件：sidepanel 聊天、模型列表、`ai/openai` 后台流式。
- **阶段 3 / 4 / 5**：尚未开始，按原计划推进（工作区/文档/上传/PDF/图片接口、`apps/collab-server` 合并入 `apps/server/src/collab`）。
- **共享包 `packages/api-common`**：当前实现仍在 `apps/server/src/shared/*`；后续若 web/extension 需要复用类型再抽包，目前 web 用 `apps/web/lib/api-types.ts` 独立维护。

### 保留在 `apps/web` 的路由

- `app/api/auth/*`（NextAuth）
- `app/api/extension/auth-status`（插件登录状态查询，待迁到 `/api/extension/api-token` 后再处理）
- 第二/三批仍在 web：`workspaces`、`editor-documents`、`document`、`documents`、`files`、`uploadthing`、`pdf`、`image`、`unsplash`、`users`、`vote`、`suggestions`、`invite`

### 本地启动

```bash
# 同时启动 web + server (含 HTTP API 与 Collab WebSocket)
pnpm dev:all

# 仅启动后端
pnpm dev:server
```

需要的环境变量见 `turbo.json#@repo/server#dev.env`，关键项：
`SERVER_HTTP_PORT=4000`、`SERVER_COLLAB_PORT=1234`、`WEB_ORIGIN=http://localhost:3000`、`API_ORIGIN=http://localhost:4000`、`NEXT_PUBLIC_API_ORIGIN=http://localhost:4000`、`API_AUTH_SECRET=<32+ 字符>`，以及插件侧 `WXT_API_ORIGIN=http://localhost:4000`。

---

## 结论

后端框架选择 **HonoJS**。

原因很直接：这个项目的 API 目前主要是 Next Route Handlers，接口大量使用 Web 标准的 `Request`、`Response`、`ReadableStream`、SSE 和 `fetch`。Hono 的核心模型与这些写法高度一致，迁移成本低；同时它比 Nest 更轻，框架层开销更小，更适合“优先考虑性能”的目标。

Nest 不是不能用，但它的优势在大型团队规范、模块化 DI、装饰器生态和企业级工程约束。如果后续团队规模扩大、领域模块很多、需要强约束架构，可以再考虑 Nest + Fastify。当前阶段为了性能、流式接口、插件跨域、低迁移成本，Hono 更合适。

## 当前问题

现在 `apps/web` 同时承载：

- Next 页面、布局和前端交互。
- NextAuth 登录与会话。
- 业务 API，例如 `/api/chat`、`/api/history`、`/api/workspaces`、`/api/editor-documents`。
- 文件上传、PDF 解析、图片生成、模型列表。
- 给协同编辑签发 token 的 `/api/collab/token`。
- 给浏览器插件补丁式支持的 CORS，例如 `/api/chat` 里的 `OPTIONS`。

这导致浏览器插件、Web 主站和协同服务都耦合到 Next 应用里。插件侧为了复用登录态，不得不处理 `chrome-extension://`、`moz-extension://`、Cookie、预检、fallback tab proxy 等逻辑，复杂度会持续上升。

## 目标架构

迁移后建议拆成三个边界：

```text
apps/web
  Next.js 页面、NextAuth 登录、静态资源、SSR/CSR 页面
  保留 /api/auth/*，其他业务 API 逐步迁出

apps/server
  Hono HTTP API + Hocuspocus 协同服务
  HTTP API 承载业务接口、AI 流式接口、文件/PDF/图片接口、工作区/文档/聊天接口
  Collab 模块承载 Hocuspocus WebSocket 协同编辑
  统一认证、CORS、错误格式、权限、限流、日志、配置与部署
```

生产域名建议：

```text
https://app.example.com       -> apps/web
https://api.example.com       -> apps/server HTTP API
wss://collab.example.com      -> apps/server Collab WebSocket
```

本地开发建议：

```text
http://localhost:3000         -> apps/web
http://localhost:4000         -> apps/server HTTP API
ws://localhost:1234           -> apps/server Collab WebSocket
```

## 登录与会话方案

登录继续使用 NextAuth.js，保留在 `apps/web`：

```text
apps/web/app/(auth)/api/auth/[...nextauth]/route.ts
```

新后端不负责登录页面、OAuth 回调、注册页和 NextAuth provider。新后端只负责“识别当前请求是谁”。

推荐认证方案分两层：

### 1. Web 主站请求

Web 页面调用 `apps/server` 的 HTTP API 时，优先使用 Cookie 会话：

```ts
fetch(`${API_ORIGIN}/api/chat`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
```

后端用 Auth.js 的 JWT 工具解码 NextAuth 会话 Cookie。不要用 `jsonwebtoken.verify()` 直接读 NextAuth Cookie，因为 Auth.js JWT 会话不是 Collab 模块自定义协同 token 那种普通 JWT。

如果部署到 `app.example.com` 与 `api.example.com`：

- NextAuth Cookie 需要配置为共享父域，例如 `.example.com`。
- 跨站请求需要 `SameSite=None; Secure`。
- 本地开发可以继续用 localhost，不强行启用 secure cookie。

### 2. 浏览器插件请求

插件侧推荐从“直接依赖主站 Cookie”迁移到“NextAuth 登录后换取短期 API Token”：

```text
extension
  -> app.example.com/api/extension/api-token
  -> NextAuth auth()
  -> 签发 15 分钟短期 API token
  -> extension 调 api.example.com 时使用 Authorization: Bearer <token>
```

这样做的好处：

- 插件不再依赖第三方 Cookie 行为。
- Hono 后端不需要为每个接口写浏览器插件专属 CORS 分支。
- API token 可以短有效期、可刷新、可撤销。
- 现有登录流程仍然是 NextAuth，不改变用户登录体验。

短期 API token 可以使用独立密钥：

```env
API_AUTH_SECRET=...
API_TOKEN_TTL_SECONDS=900
```

协同编辑 token 仍然是专用 token，不直接复用 API token：

```text
POST /api/collab/token
  验证用户登录态或 API token
  检查文档权限
  签发给 Hocuspocus 使用的 24h collab token
```

## CORS 策略

CORS 应该在 Hono 全局统一处理，不再散落在每个 route 里。

允许来源：

- Web 主站来源：`NEXT_PUBLIC_APP_URL` / `WEB_ORIGIN`
- 浏览器插件来源：配置化的 `chrome-extension://<id>`、`moz-extension://<id>`
- 本地开发来源：`http://localhost:3000`、WXT dev origin

不要用宽松的 `*` 配合 credentials。建议使用 allowlist：

```ts
const allowedOrigins = new Set([
  process.env.WEB_ORIGIN,
  process.env.CHROME_EXTENSION_ORIGIN,
  process.env.FIREFOX_EXTENSION_ORIGIN,
].filter(Boolean));

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      if (allowedOrigins.has(origin)) return origin;
      if (process.env.NODE_ENV !== "production") {
        if (origin.startsWith("http://localhost:")) return origin;
        if (origin.startsWith("chrome-extension://")) return origin;
        if (origin.startsWith("moz-extension://")) return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 86400,
  })
);
```

插件使用 `Authorization` 后，`Access-Control-Allow-Headers` 不再需要允许 `Cookie`。Cookie 由浏览器管理，不应手动拼接。

## API 迁移清单

当前 `apps/web/app/api` 路由清单：

| 模块 | 路由 | 方法 | 迁移建议 |
| --- | --- | --- | --- |
| AI 聊天 | `/api/chat` | `POST, DELETE, OPTIONS` | 第一批迁移，重点验证 SSE/stream |
| AI 聊天 | `/api/chat/[id]` | `GET` | 第一批迁移 |
| AI 聊天 | `/api/chat/[id]/messages` | `GET, OPTIONS` | 第一批迁移 |
| AI 聊天 | `/api/chat/[id]/stream` | `GET` | 第一批迁移，保留 resumable stream 能力 |
| AI 聊天 | `/api/chat/[id]/title` | `GET` | 第一批迁移 |
| 历史记录 | `/api/history` | `GET, DELETE, OPTIONS` | 第一批迁移 |
| 模型 | `/api/models` | `GET` | 第一批迁移 |
| 工作区 | `/api/workspaces` | `GET, POST, PATCH, DELETE, OPTIONS` | 第二批迁移 |
| 工作区 | `/api/workspaces/[id]` | `PATCH, DELETE` | 第二批迁移 |
| 工作区 | `/api/workspaces/[id]/invite` | `POST` | 第二批迁移 |
| 工作区 | `/api/workspaces/members` | `GET, POST, PATCH, DELETE` | 第二批迁移 |
| 工作区 | `/api/workspaces/switch` | `POST` | 第二批迁移 |
| 文档 | `/api/editor-documents` | `GET, POST` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]` | `GET, PATCH, DELETE` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/collaborators` | `GET, POST, PATCH, DELETE` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/duplicate` | `POST` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/move` | `POST` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/path` | `GET` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/public-edit` | `POST, DELETE` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/publish` | `POST, DELETE` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/restore` | `POST` | 第二批迁移 |
| 文档 | `/api/editor-documents/[id]/visit` | `POST` | 第二批迁移 |
| 文档 | `/api/editor-documents/all` | `GET` | 第二批迁移 |
| 文档 | `/api/editor-documents/shared-with-me` | `GET` | 第二批迁移 |
| 文档邀请 | `/api/editor-documents/collaborator-invite/[token]` | `GET, POST` | 第二批迁移，注意匿名/受邀访问 |
| 旧文档 | `/api/document` | `GET, POST, DELETE` | 迁移后评估是否合并到 editor-documents |
| 旧文档 | `/api/documents` | `GET` | 迁移后评估是否合并 |
| 协同 | `/api/collab/token` | `POST` | 第一批迁移，并抽出 auth/permission 共享模块 |
| 文件 | `/api/files/upload` | `POST` | 第三批迁移 |
| 文件 | `/api/uploadthing` | `GET, POST` | 第三批迁移，若 UploadThing Next handler 绑定较深可暂留 web |
| PDF | `/api/pdf/parse` | `POST` | 第三批迁移，适合后端独立处理大文件 |
| 图片 | `/api/image/generations` | `POST` | 第三批迁移 |
| 图片 | `/api/image/history` | `GET` | 第三批迁移 |
| 图片 | `/api/image/tasks/[id]` | `GET` | 第三批迁移 |
| 其他 AI | `/api/ai/completion` | `POST` | 第一批迁移 |
| 其他 AI | `/api/ai/openai` | `POST` | 第一批迁移 |
| 投票 | `/api/vote` | `GET, PATCH` | 第二批迁移 |
| 建议 | `/api/suggestions` | `GET` | 第二批迁移 |
| 邀请 | `/api/invite/[code]` | `GET` | 第二批迁移 |
| 邀请 | `/api/invite/join` | `POST` | 第二批迁移 |
| 用户 | `/api/users/[id]` | `GET` | 第二批迁移 |
| Unsplash | `/api/unsplash` | `GET` | 第三批迁移 |
| 扩展认证状态 | `/api/extension/auth-status` | `GET` | 替换为 `/api/extension/api-token` 或保留在 web |

明确保留在 `apps/web` 的路由：

| 路由 | 原因 |
| --- | --- |
| `/api/auth/*` | NextAuth 登录、OAuth callback、session 管理继续归 Next |
| 页面路由 | Next.js 页面职责不迁移 |
| 特别依赖 Next runtime 的上传回调 | 可短期保留，后续单独替换 |

## 迁移阶段

### 阶段 0：新增 Hono 后端骨架

新增或重命名为：

```text
apps/server/
  src/index.ts
  src/http/app.ts
  src/http/middleware/cors.ts
  src/http/routes/
    ai/index.ts
    ai/handlers.ts
    ai/schema.ts
    chat/index.ts
    chat/handlers.ts
    chat/schema.ts
    collab/index.ts
    collab/handlers.ts
    collab/schema.ts
    history/index.ts
    history/handlers.ts
    models/index.ts
    models/handlers.ts
    models/schema.ts
    workspaces/index.ts          # 第二批起按同约定新增
    workspaces/handlers.ts
    workspaces/schema.ts
    editor-documents/index.ts
    editor-documents/handlers.ts
    editor-documents/schema.ts
  src/collab/server.ts
  src/collab/auth.ts
  src/collab/extensions/database.ts
  src/collab/extensions/redis.ts
  src/shared/auth.ts
  src/shared/permissions.ts
  src/shared/config.ts
```

### HTTP 路由模块约定

每个业务模块占一个目录，文件职责固定：

| 文件 | 职责 | 示例 |
| --- | --- | --- |
| `index.ts` | 创建 `Hono` 实例，注册 HTTP path | `chatRoutes.post("/", postChatHandler)` |
| `handlers.ts` | 请求处理：鉴权、调 DB/AI、返回 `Response` | `export async function postChatHandler(c: Context)` |
| `schema.ts` | Zod schema 与推断类型 | `postRequestBodySchema`、`PostRequestBody` |

约定细则：

- `index.ts` 理想状态仅十几行，不含业务逻辑；需要对外 re-export 的符号（如 `getStreamContext`）可从 `handlers.ts` 再导出。
- 仅 query 参数、无 body 校验的模块（如 `history`）可不建 `schema.ts`，校验留在 handler 内。
- handler 命名建议 `{动作}{资源}Handler`，如 `listHistoryHandler`、`createTokenHandler`。
- `app.ts` 使用 `./routes/<module>/index.js` 显式 import（`moduleResolution: NodeNext`）。

单模块 `index.ts` 示例：

```ts
import { Hono } from "hono";
import { postChatHandler, deleteChatHandler } from "./handlers.js";

export const chatRoutes = new Hono();
chatRoutes.post("/", postChatHandler);
chatRoutes.delete("/", deleteChatHandler);
```

根目录脚本：

```json
{
  "dev:server": "turbo dev --filter=@repo/server",
  "dev:all": "turbo dev --filter=@repo/web --filter=@repo/server"
}
```

新增环境变量：

```env
NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
WXT_API_ORIGIN=http://localhost:4000
SERVER_HTTP_PORT=4000
SERVER_COLLAB_PORT=1234
WEB_ORIGIN=http://localhost:3000
API_AUTH_SECRET=change-me
CHROME_EXTENSION_ORIGIN=chrome-extension://<extension-id>
FIREFOX_EXTENSION_ORIGIN=moz-extension://<extension-id>
```

### 阶段 1：认证、错误、CORS 先统一

先迁移基础能力，不急着搬业务：

- `requireUser()`：从 Cookie 或 Bearer token 得到用户。
- `optionalUser()`：公开文档、邀请链接等接口使用。
- `assertWorkspaceAccess()`、`assertDocumentAccess()`：从 `apps/web/lib` 抽到共享包或直接放入 API。
- `ApiError`：统一错误结构，替换 `ChatSDKError` 的 web-only 依赖。
- `cors()`：全局处理插件与 Web 主站跨域。
- `requestId`、日志、耗时统计。

建议新增共享包：

```text
packages/api-common/
  src/errors.ts
  src/auth-token.ts
  src/permissions.ts
  src/response.ts
```

### 阶段 2：优先迁移插件最痛的接口

第一批迁移：

- `/api/chat`
- `/api/chat/[id]`
- `/api/chat/[id]/messages`
- `/api/chat/[id]/stream`
- `/api/history`
- `/api/models`
- `/api/collab/token`
- `/api/ai/completion`
- `/api/ai/openai`

迁移原则：

- 保持 URL path 与响应格式不变。
- Web 前端和插件只改 `NEXT_PUBLIC_API_ORIGIN` / `API_ORIGIN` 指向 `apps/server` 的 HTTP API，不改业务调用语义。
- `/api/chat` 必须保留流式响应，验证 AI SDK 的流输出在 Hono 下可正常消费。
- 迁移后删除 route 内部零散的 `OPTIONS` 和 `withExtensionCors`。
- 新迁入的 route 按「HTTP 路由模块约定」拆为 `index.ts` + `handlers.ts` + `schema.ts`（可选），不要新增 `routes/*.ts` 单文件。

### 阶段 3：迁移工作区与文档权限接口

第二批迁移：

- `/api/workspaces*`
- `/api/editor-documents*`
- `/api/document`
- `/api/documents`
- `/api/vote`
- `/api/suggestions`
- `/api/invite*`
- `/api/users/[id]`

这一阶段重点是权限一致性。建议先把 `apps/web/lib/document-access.ts`、`apps/web/lib/workspace-access.ts` 和当前 `apps/collab-server/src/document-permission.ts` 收敛到 `apps/server/src/shared/permissions.ts`，避免 Web API、HTTP API、协同服务三套判断不一致。

### 阶段 4：迁移重任务接口

第三批迁移：

- `/api/files/upload`
- `/api/uploadthing`
- `/api/pdf/parse`
- `/api/image/generations`
- `/api/image/history`
- `/api/image/tasks/[id]`
- `/api/unsplash`

这一阶段建议顺手加：

- 文件大小限制统一配置。
- 上传、PDF、图片生成的任务队列或状态表。
- API 超时与重试策略。
- 后端侧对象存储抽象，避免上传实现绑定 Next。

### 阶段 5：协同服务合并到 `apps/server`

将当前 `apps/collab-server` 的 Hocuspocus 代码迁入 `apps/server/src/collab`。它和 Hono HTTP API 位于同一个后端应用目录，复用同一套共享模块，但运行时仍可以监听不同端口：

```text
apps/server
  HTTP API: http://localhost:4000
  Collab WS: ws://localhost:1234
```

需要改的不是“把 Hocuspocus 硬塞进 Hono”，而是统一这些能力：

- 使用同一个 `verifyApiToken()` 或 `verifyCollabToken()`。
- 使用同一个 `checkDocumentPermission()`。
- 使用同一套 env 配置。
- `apps/server` 的 HTTP API 负责签发 collab token。
- 反向代理层统一域名和 TLS。

最终：

```text
POST https://api.example.com/api/collab/token
  -> apps/server HTTP API
  -> 签发 collab token

wss://collab.example.com
  -> apps/server Collab WebSocket
  -> 校验 collab token
```

## 前端与插件改造

Web 前端新增：

```ts
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:4000";

export function apiUrl(path: string) {
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
```

把：

```ts
fetch("/api/chat")
```

改为：

```ts
fetch(apiUrl("/api/chat"), { credentials: "include" })
```

插件侧把：

```ts
WEB_ORIGIN + "/api/chat"
```

改为：

```ts
API_ORIGIN + "/api/chat"
```

并优先使用：

```ts
headers: {
  Authorization: `Bearer ${apiToken}`,
}
```

`WEB_ORIGIN` 仍然保留，用于打开主站登录、换取 API token、同步登录状态。

## 反向代理建议

为了降低前端改动，也可以在生产先用网关保持路径不变：

```text
app.example.com/api/auth/*  -> apps/web
app.example.com/api/*       -> apps/server HTTP API
app.example.com/*           -> apps/web
collab.example.com/*        -> apps/server Collab WebSocket
```

这样 Web 主站仍可以请求 `/api/chat`，但真正处理者已经是 Hono。插件也可以直接请求 `https://api.example.com/api/chat`，逐步摆脱主站 API。

## 验收标准

每一批迁移都要满足：

- Web 主站对应功能可用。
- 浏览器插件对应功能可用。
- 未登录返回稳定 JSON，不返回登录页 HTML。
- CORS 预检成功，且只允许配置过的来源。
- `/api/chat` 流式响应首 token 延迟不明显变差。
- `POST /api/collab/token` 签发 token 后，Hocuspocus 可正常连接。
- 权限错误、工作区错误、文档不存在错误的状态码与前端预期一致。
- Docker Compose 可同时启动 web、server、postgres、redis，其中 server 同时提供 HTTP API 与 Collab WebSocket。

## 风险与处理

| 风险 | 处理 |
| --- | --- |
| NextAuth Cookie 跨子域或插件请求不稳定 | 插件改用短期 API token，Web 请求保留 Cookie |
| Auth.js JWT 与自定义 JWT 混淆 | NextAuth Cookie 用 Auth.js 工具读，API/collab token 用独立签名 |
| 流式接口迁移后断流 | 第一批只迁移 chat，并用插件和 Web 双端验证 SSE |
| 权限逻辑分叉 | 抽出 `apps/server/src/shared/permissions.ts`，HTTP API 与 Collab 模块共用 |
| UploadThing 与 Next handler 耦合 | 短期保留在 web，后续替换为后端上传实现 |
| 路径切换影响大 | 先用反向代理保持 `/api/*` 不变，再逐步改 `API_ORIGIN` |

## 为什么不是 Nest

Nest 的优势：

- 模块、Provider、Guard、Interceptor 体系完整。
- 团队规模大时更容易统一风格。
- 对传统 REST 后端、复杂领域服务、企业工程治理友好。

当前项目更适合 Hono：

- 已有 API 与 Web 标准对象贴近，Hono 迁移阻力小。
- `/api/chat`、`/api/ai/*`、插件请求都对流式与低开销更敏感。
- 当前 monorepo 已经有 `packages/database`、`packages/ai`、`packages/editor`，不急需 Nest 的 DI 容器来组织依赖。
- Hocuspocus 已经是独立协同进程，后端核心需要的是轻量 HTTP API 与统一认证，不是完整应用框架。

可以重新考虑 Nest 的条件：

- 后端团队人数增加，需要强制模块边界与统一开发范式。
- 业务域明显膨胀到 billing、admin、audit、notification、queue 等多个独立模块。
- 需要大量 Guard、Interceptor、Pipe、Swagger 装饰器式治理。
- 性能瓶颈已经不在框架层，而在数据库、队列、外部模型服务。

## 官方参考

- Hono Benchmarks: https://hono.dev/docs/concepts/benchmarks
- Hono CORS Middleware: https://hono.dev/docs/middleware/builtin/cors
- Hono RPC: https://hono.dev/docs/guides/rpc
- Nest Performance / Fastify: https://docs.nestjs.com/techniques/performance
- Auth.js Session Strategies: https://authjs.dev/concepts/session-strategies
- Auth.js JWT Reference: https://authjs.dev/reference/core/jwt
