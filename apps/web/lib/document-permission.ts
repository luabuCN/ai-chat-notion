/**
 * 文档权限检查核心逻辑
 *
 * 权限漏斗模型（优先级从高到低）：
 * 1. 超级特权 (Owner/Admin) - 文档所有者、工作空间所有者、工作空间管理员
 * 2. 显式文档授权 (Doc Level) - 文档协作者权限（可以覆盖工作空间权限）
 * 3. 空间基础角色 (Space Level) - 工作空间成员权限
 * 4. 公开协作 (Public Editable) - 任何人可编辑（`isPubliclyEditable`）
 * 5. 只读发布 (Public Readonly) - 任何人可查看（`isPublished`）
 * 6. 拒绝 (Deny) - 无权限
 */

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentPermissionParams {
  documentId: string;
  documentUserId: string;
  documentWorkspaceId: string | null;
  /** 只读发布：开启后匿名用户可 view（仅读取） */
  documentIsPublished: boolean;
  /** 公开协作：开启后匿名用户可 edit */
  documentIsPubliclyEditable?: boolean;
  documentDeletedAt: Date | null;
  /**
   * 垃圾箱内文档默认会被判为无权限；还原/永久删除等操作需按「未删除」时的身份继续计算 owner/edit/view
   */
  ignoreDeletedAt?: boolean;
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
    documentIsPubliclyEditable,
    documentDeletedAt,
    ignoreDeletedAt,
    currentUserId,
    currentUserEmail,
    workspaceOwnerId,
    workspaceMemberRole,
    workspaceMemberPermission,
    documentCollaboratorPermission,
    documentCollaboratorStatus,
  } = params;

  // 已删除的文档：所有者仍可查看（前端会显示只读红色标识），其他人无权访问
  // 垃圾箱还原 / 永久删除操作传入 ignoreDeletedAt=true 以跳过此判断
  if (documentDeletedAt && !ignoreDeletedAt) {
    // 文档所有者可以查看自己的已删除文档（只读）
    if (currentUserId && documentUserId === currentUserId) {
      return createPermissionResult("owner", "Document owner (deleted)", true);
    }
    // 工作空间所有者也可以查看
    if (documentWorkspaceId && workspaceOwnerId && workspaceOwnerId === currentUserId) {
      return createPermissionResult("owner", "Workspace owner (deleted)", true);
    }
    return createPermissionResult("none", "Document is deleted");
  }

  // 未登录用户
  if (!currentUserId) {
    if (documentIsPubliclyEditable) {
      return createPermissionResult("edit", "Publicly editable document");
    }
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
  // 4. 公开协作 (Public Editable)
  // ========================================
  // 任何已登录但无其它权限的用户亦可编辑公开协作文档
  if (documentIsPubliclyEditable) {
    return createPermissionResult("edit", "Publicly editable document");
  }

  // ========================================
  // 5. 只读发布 (Public Readonly)
  // ========================================
  // 任何已登录但无其它权限的用户亦可查看只读发布文档
  if (documentIsPublished) {
    return createPermissionResult("view", "Public published document");
  }

  // ========================================
  // 6. 拒绝 (Deny)
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
