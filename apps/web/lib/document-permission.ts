/**
 * 文档权限检查核心逻辑
 *
 * 权限漏斗模型（优先级从高到低）：
 * 1. 超级特权 (Owner/Admin) - 文档所有者、工作空间所有者、工作空间管理员
 * 2. 显式文档授权 (Doc Level) - 文档协作者权限（可以覆盖工作空间权限）
 * 3. 空间基础角色 (Space Level) - 工作空间成员权限
 * 4. 公开链接 (Public) - 已发布文档的公开访问（只读）
 * 5. 拒绝 (Deny) - 无权限
 */

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentPermissionParams {
  documentId: string;
  documentUserId: string;
  documentWorkspaceId: string | null;
  documentIsPublished: boolean;
  documentDeletedAt: Date | null;
  currentUserId?: string;
  currentUserEmail?: string;
  workspaceOwnerId?: string;
  workspaceMemberRole?: string;
  workspaceMemberPermission?: string;
  documentCollaboratorPermission?: string;
  documentCollaboratorStatus?: string;
}

export interface DocumentPermissionResult {
  access: AccessLevel;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canPublish: boolean;
  isOwner: boolean;
  isCollaborator: boolean;
  reason: string; // 用于调试，说明权限来源
}

/**
 * 核心权限检查函数（漏斗模型）
 * 可以在客户端和服务端共用
 */
export function checkDocumentPermission(
  params: DocumentPermissionParams
): DocumentPermissionResult {
  const {
    documentUserId,
    documentWorkspaceId,
    documentIsPublished,
    documentDeletedAt,
    currentUserId,
    currentUserEmail,
    workspaceOwnerId,
    workspaceMemberRole,
    workspaceMemberPermission,
    documentCollaboratorPermission,
    documentCollaboratorStatus,
  } = params;

  // 已删除的文档不允许访问
  if (documentDeletedAt) {
    return createPermissionResult("none", "Document is deleted");
  }

  // 未登录用户
  if (!currentUserId) {
    if (documentIsPublished) {
      return createPermissionResult("view", "Public published document");
    }
    return createPermissionResult("none", "Not authenticated");
  }

  // ========================================
  // 1. 超级特权检查 (Owner/Admin)
  // ========================================

  // 1.1 文档所有者 - 完全权限
  if (documentUserId === currentUserId) {
    return createPermissionResult("owner", "Document owner", true);
  }

  // 1.2 工作空间所有者 - 完全权限
  if (documentWorkspaceId && workspaceOwnerId === currentUserId) {
    return createPermissionResult("owner", "Workspace owner", true);
  }

  // 1.3 工作空间管理员 - 编辑权限
  // 管理员可以编辑所有文档，但不能删除或修改空间设置
  if (documentWorkspaceId && workspaceMemberRole === "admin") {
    return createPermissionResult("edit", "Workspace admin");
  }

  // ========================================
  // 2. 显式文档授权 (Doc Level) ⭐ 关键
  // ========================================
  // 文档协作者权限优先于工作空间成员权限
  // 这允许给工作空间"观察者"单独授予文档"编辑"权限

  if (
    currentUserEmail &&
    documentCollaboratorStatus === "accepted" &&
    documentCollaboratorPermission
  ) {
    if (documentCollaboratorPermission === "edit") {
      return createPermissionResult(
        "edit",
        "Document collaborator (edit)",
        false,
        true
      );
    }
    if (documentCollaboratorPermission === "view") {
      return createPermissionResult(
        "view",
        "Document collaborator (view)",
        false,
        true
      );
    }
  }

  // ========================================
  // 3. 空间基础角色 (Space Level)
  // ========================================
  // 工作空间成员的默认权限

  if (documentWorkspaceId && workspaceMemberPermission) {
    if (workspaceMemberPermission === "edit") {
      return createPermissionResult("edit", "Workspace member (edit)");
    }
    if (workspaceMemberPermission === "view") {
      return createPermissionResult("view", "Workspace member (view)");
    }
  }

  // ========================================
  // 4. 公开链接 (Public)
  // ========================================
  // 已发布文档的公开访问（只读）

  if (documentIsPublished) {
    return createPermissionResult("view", "Public published document");
  }

  // ========================================
  // 5. 拒绝 (Deny)
  // ========================================

  return createPermissionResult("none", "No permission");
}

/**
 * 创建权限结果对象
 */
function createPermissionResult(
  access: AccessLevel,
  reason: string,
  isOwner: boolean = false,
  isCollaborator: boolean = false
): DocumentPermissionResult {
  const canView = access !== "none";
  const canEdit = access === "owner" || access === "edit";
  const canDelete = access === "owner";
  const canShare = access === "owner" || access === "edit";
  const canPublish = access === "owner";

  return {
    access,
    canView,
    canEdit,
    canDelete,
    canShare,
    canPublish,
    isOwner,
    isCollaborator,
    reason,
  };
}
