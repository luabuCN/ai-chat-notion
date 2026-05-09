# 权限变更后的运行时校验改造方案

## 背景

当前文档分享和空间成员设置都可以修改用户的权限或角色：

- 单文档分享：`DocumentCollaborator.permission`，支持 `view` / `edit`。
- 空间成员：`WorkspaceMember.role`，支持 `owner` / `admin` / `member`；`WorkspaceMember.permission`，支持 `view` / `edit`。

现状问题是：用户已经打开文档并处于编辑状态后，如果管理员把该用户从 `edit/admin` 降级为 `view/member`，前端页面不会立刻感知。普通 HTTP 写接口多数会重新调用 `verifyDocumentAccess`，但协同编辑 WebSocket 在连接认证通过后会继续接收 Yjs 增量，只有刷新页面或重连后才会体现新权限。

目标不是强实时推送，而是做到：任何需要写权限或管理员权限的操作，在真正执行时都重新校验当前权限；权限不足时返回明确错误，前端提示用户并停止继续编辑。

## 当前关键代码位置

- 统一文档权限计算：`apps/web/lib/document-permission.ts`
- Web 侧文档权限查询：`apps/web/lib/document-access.ts`
- 协同服务权限查询：`apps/collab-server/src/auth.ts`
- 协同服务入口：`apps/collab-server/src/server.ts`
- 协同服务持久化：`apps/collab-server/src/extensions/database.ts`
- 文档主接口：`apps/web/app/api/editor-documents/[id]/route.ts`
- 文档协作者接口：`apps/web/app/api/editor-documents/[id]/collaborators/route.ts`
- 公开协作接口：`apps/web/app/api/editor-documents/[id]/public-edit/route.ts`
- 发布接口：`apps/web/app/api/editor-documents/[id]/publish/route.ts`
- 移动/复制/恢复接口：
  - `apps/web/app/api/editor-documents/[id]/move/route.ts`
  - `apps/web/app/api/editor-documents/[id]/duplicate/route.ts`
  - `apps/web/app/api/editor-documents/[id]/restore/route.ts`
- 空间成员接口：`apps/web/app/api/workspaces/members/route.ts`
- 空间邀请接口：`apps/web/app/api/workspaces/[id]/invite/route.ts`

## 权限等级建议

建议把操作分成三类，避免所有地方都只判断 `owner/edit`：

| 操作类型 | 需要权限 | 示例 |
| --- | --- | --- |
| 查看 | `owner` / `edit` / `view` | 打开文档、读取协作者列表中的可见信息 |
| 编辑内容 | `owner` / `edit` | 正文编辑、标题、图标、封面、移动到父文档、恢复、软删除 |
| 管理权限 | `owner`，或空间 `owner/admin` | 修改文档协作者权限、删除协作者、开启公开协作、修改空间成员角色/权限、邀请空间成员 |

说明：当前代码里 `publish`、`public-edit`、`collaborators POST/DELETE` 的权限边界并不完全一致，有些允许 `edit` 操作。需要产品确认：分享、公开协作、发布是否属于“管理员权限操作”。如果是，就应收紧为 `owner` 或空间 `admin/owner`。

## 需要修改的 HTTP 接口

### 1. 新增统一断言工具

建议新增 `apps/web/lib/permission-assert.ts`，封装以下能力：

- `assertDocumentCanView(documentId, user)`
- `assertDocumentCanEdit(documentId, user)`
- `assertDocumentCanManage(documentId, user)`
- `assertWorkspaceCanManage(workspaceId, userId)`

这些方法内部统一调用 `verifyDocumentAccess` 或空间成员查询，失败时返回统一错误码：

```json
{
  "code": "permission_changed",
  "message": "你的权限已变更，当前操作无法继续"
}
```

这样前端可以对 `403 + permission_changed` 做统一 toast 和状态降级。

### 2. 文档更新接口

文件：`apps/web/app/api/editor-documents/[id]/route.ts`

需要调整：

- `PATCH`：继续在每次保存前调用当前权限，但建议改为 `assertDocumentCanEdit`。
- `DELETE`：如果软删除仍允许编辑者删除，使用 `assertDocumentCanEdit`；如果删除属于管理操作，改为 `assertDocumentCanManage`。
- 返回 `403` 时使用统一错误码，前端收到后关闭编辑态或切换只读。

### 3. 协作者管理接口

文件：`apps/web/app/api/editor-documents/[id]/collaborators/route.ts`

需要调整：

- `GET`：如果只是展示分享面板，可保留 `edit/owner`；如果“成员/访客与公众”只允许管理员查看，改为 `assertDocumentCanManage`。
- `POST`：邀请协作者，建议改为 `assertDocumentCanManage`。
- `PATCH`：当前截图里有“修改协作者权限”的操作，但此路由文件目前只看到 `GET/POST/DELETE`，需要补一个 `PATCH` 或确认前端调用的是别的接口。该接口必须每次操作前调用 `assertDocumentCanManage`。
- `DELETE`：删除协作者，建议改为 `assertDocumentCanManage`。

### 4. 公开协作接口

文件：`apps/web/app/api/editor-documents/[id]/public-edit/route.ts`

需要调整：

- `POST` 开启公开协作：改为 `assertDocumentCanManage`。
- `DELETE` 关闭公开协作：改为 `assertDocumentCanManage`。
- 权限不足时前端应回滚开关状态并提示。

### 5. 发布接口

文件：`apps/web/app/api/editor-documents/[id]/publish/route.ts`

需要产品确认发布是否属于管理操作：

- 如果发布只是内容编辑的一部分，保留 `assertDocumentCanEdit`。
- 如果发布会影响外部访问范围，建议改为 `assertDocumentCanManage`。

### 6. 移动、恢复、复制接口

文件：

- `apps/web/app/api/editor-documents/[id]/move/route.ts`
- `apps/web/app/api/editor-documents/[id]/restore/route.ts`
- `apps/web/app/api/editor-documents/[id]/duplicate/route.ts`

需要调整：

- `move`：当前调用 `verifyDocumentAccess(id, user.id)`，没有传 `user.email`，会漏掉按邮箱分享的协作者权限；需要传 `user.email`。移动目标父文档也一样。
- `restore`：继续使用 `ignoreDeletedAt: true`，但封装为 `assertDocumentCanEdit(..., { ignoreDeletedAt: true })`。
- `duplicate`：当前先验 `access !== none`，但数据库层 `duplicateEditorDocument` 又要求 `original.userId === userId`，导致被分享用户看似可复制、实际失败。需要统一为“可查看即可复制到自己名下”或“只有 owner 可复制”。这不是本次实时权限的主问题，但会影响权限提示一致性。

### 7. 空间成员和邀请接口

文件：

- `apps/web/app/api/workspaces/members/route.ts`
- `apps/web/app/api/workspaces/[id]/invite/route.ts`

需要调整：

- `PATCH /api/workspaces/members`：当前会查询当前用户成员信息，但建议改为 `assertWorkspaceCanManage`，并保留“管理员不能操作 owner/admin”的规则。
- `DELETE /api/workspaces/members`：如果是管理员移除成员，应允许 `owner/admin`，但成员自己退出仍单独允许。
- `POST /api/workspaces/members`：当前只有 owner 可添加，若产品允许 admin 邀请，改为 `assertWorkspaceCanManage`。
- `POST /api/workspaces/[id]/invite`：每次邀请前校验当前用户仍是 `owner/admin`。

## 需要修改的协同服务

### 1. Token 生成时只代表“当时权限”

文件：`apps/web/app/api/collab/token/route.ts`

当前 token 有效期 24 小时，并把 `accessLevel` 写进 token。这个 `accessLevel` 不能作为长期可信权限，因为管理员随时可能改权限。

需要调整：

- token 仍可用于身份认证，但协同服务不能只信 token 内的 `accessLevel`。
- 获取 token 时如果只是进入协同编辑，应要求 `owner/edit`；如果只读用户也需要连协同服务看实时变化，则需要在协同服务区分 read-only 和 editable。
- 建议把 token 过期时间缩短到 15-60 分钟，降低旧权限窗口。

### 2. 连接时校验仍保留

文件：`apps/collab-server/src/server.ts`

`onAuthenticate` 继续调用 `verifyDocumentAccess(documentName, payload.userId, payload.email)`。

需要调整：

- 如果该连接用于编辑，`access` 必须是 `owner/edit`。
- 把 `accessLevel` 只作为连接上下文的初始状态，不作为后续写入的最终依据。

### 3. 写入增量时二次校验

文件：`apps/collab-server/src/server.ts`

需要在协同写入链路增加“写操作前/写操作时”的权限校验。优先方案：

- 在 Hocuspocus 支持的写消息钩子中校验当前用户是否仍有 `owner/edit`。
- 如果只使用现有 `onChange`，也要在 `onChange({ documentName, context })` 中重新调用 `verifyDocumentAccess`。
- 校验失败时：
  - 抛出明确错误或主动断开当前连接。
  - 通过 WebSocket 错误消息让前端提示“你的权限已变更，已切换为只读”。
  - 禁止继续发送本地编辑增量。

为了降低数据库压力，可以加短缓存：

- key：`documentId:userId:userEmail`
- ttl：5-10 秒
- 权限管理接口成功修改权限后，主动清理相关缓存。

### 4. 持久化前兜底校验

文件：`apps/collab-server/src/extensions/database.ts`

`store` 当前会直接把 Yjs state 和 JSON content 写入 `EditorDocument`。

需要调整：

- `store({ documentName, state, context })` 前检查 `context.user` 是否仍有 `owner/edit`。
- 如果权限不足，不写库，并记录日志。
- 这一步是兜底，不能替代写入增量校验，因为只在 debounce 持久化时发生。

### 5. 权限变更后的主动通知，可作为二期

如果希望更接近实时，可以在以下接口成功后发布权限变更事件：

- `PATCH /api/workspaces/members`
- `DELETE /api/workspaces/members`
- `POST/PATCH/DELETE /api/editor-documents/[id]/collaborators`
- `POST/DELETE /api/editor-documents/[id]/public-edit`

事件内容：

```json
{
  "type": "permission.changed",
  "documentId": "xxx",
  "workspaceId": "xxx",
  "affectedUserIds": ["xxx"],
  "affectedEmails": ["a@example.com"]
}
```

协同服务收到事件后：

- 清理权限缓存。
- 找到受影响的连接并重新校验。
- 权限降级为 `view/none` 时断开编辑连接或切换只读。

当前仓库已有协同 Redis 扩展，可以优先复用 Redis pub/sub 做这个事件。

## 前端需要配合的点

### 1. 统一处理 403

所有会修改权限、内容、空间成员的请求，如果返回 `403` 且 code 为 `permission_changed`：

- toast：`你的权限已变更，当前操作无法继续`
- 回滚当前 UI 操作，例如下拉框、开关、分享面板状态。
- 重新拉取当前文档和空间成员数据。

### 2. 编辑器切换只读

协同服务返回权限错误或断开连接时：

- 停止本地编辑输入。
- 切换编辑器 `editable=false`。
- 重新请求 `GET /api/editor-documents/[id]` 获取最新 `accessLevel`。
- 如果 `accessLevel=view`，保留查看页面；如果 `none`，跳转或展示无权限页面。

### 3. 分享面板和空间设置面板刷新

打开分享面板、空间设置面板时应重新请求数据，不使用页面初始缓存作为最终权限依据。

## 推荐实施顺序

1. 新增统一权限断言工具和统一 `permission_changed` 错误返回。
2. 改造 HTTP 写接口：文档更新、分享管理、公开协作、发布、移动、恢复、空间成员管理。
3. 改造协同服务：连接认证要求编辑权限，写增量时二次校验，持久化前兜底校验。
4. 前端统一处理 `403 permission_changed`，编辑器支持降级只读。
5. 二期加入 Redis 权限变更事件，主动断开或降级在线连接。

## 验收场景

| 场景 | 预期 |
| --- | --- |
| 用户 A 正在编辑文档，管理员把 A 的文档权限从 `edit` 改成 `view` | A 下一次保存或协同增量写入被拒绝，页面提示权限已变更，编辑器切为只读 |
| 用户 A 打开分享面板，管理员取消 A 的 admin 身份，A 再修改别人权限 | 接口返回 403，UI 回滚并提示 |
| 用户 A 正在空间设置里修改成员，owner 把 A 从 admin 改成 member | A 下一次成员管理操作被拒绝 |
| 用户 A 通过旧 token 连接协同服务，但权限已被撤销 | `onAuthenticate` 或写入校验失败，不能继续编辑 |
| 用户 A 权限从 `view` 升级为 `edit` | A 刷新或重新获取文档权限后可进入编辑；如果做二期事件，可主动提示权限已更新 |

