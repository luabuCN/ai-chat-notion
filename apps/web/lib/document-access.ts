import {
  getEditorDocumentById,
  getWorkspaceMemberPermission,
  prisma,
} from "@repo/database";
import {
  checkDocumentPermission,
  type DocumentPermissionResult,
} from "./document-permission";

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentAccessResult {
  access: AccessLevel;
  document: any;
  hasCollaborators?: boolean;
  isCurrentUserCollaborator?: boolean;
}

/**
 * 验证用户对文档的访问权限（服务端）
 *
 * 使用统一的漏斗模型权限检查逻辑
 *
 * @param documentId 文档ID
 * @param userId 用户ID（从请求头获取，由中间件注入）
 * @param userEmail 用户邮箱（用于检查访客协作者）
 */
export async function verifyDocumentAccess(
  documentId: string,
  userId?: string,
  userEmail?: string
): Promise<DocumentAccessResult> {
  try {
    const document = await getEditorDocumentById({ id: documentId });

    // 检查是否有协作者（用于决定是否启用协同编辑）
    const collaboratorCount = await prisma.documentCollaborator.count({
      where: {
        documentId,
        status: "accepted",
        permission: "edit",
      },
    });
    const hasCollaborators = collaboratorCount > 0;

    // 获取工作空间信息
    let workspaceOwnerId: string | undefined;
    let workspaceMemberRole: string | undefined;
    let workspaceMemberPermission: string | undefined;

    if (document.workspaceId && userId) {
      const workspace = await prisma.workspace.findUnique({
        where: { id: document.workspaceId },
        select: { ownerId: true },
      });
      workspaceOwnerId = workspace?.ownerId;

      const memberInfo = await getWorkspaceMemberPermission({
        workspaceId: document.workspaceId,
        userId,
      });

      if (memberInfo) {
        workspaceMemberRole = memberInfo.role;
        workspaceMemberPermission = memberInfo.permission;
      }
    }

    // 获取文档协作者信息
    let documentCollaboratorPermission: string | undefined;
    let documentCollaboratorStatus: string | undefined;
    let isCurrentUserCollaborator = false;

    if (userId && userEmail) {
      const collaborator = await prisma.documentCollaborator.findUnique({
        where: {
          documentId_email: {
            documentId,
            email: userEmail,
          },
        },
      });

      if (collaborator) {
        documentCollaboratorPermission = collaborator.permission;
        documentCollaboratorStatus = collaborator.status;
        isCurrentUserCollaborator =
          collaborator.status === "accepted" &&
          collaborator.permission === "edit";

        console.log("[Doc Access] Collaborator lookup:", {
          documentId,
          userEmail,
          collaborator,
        });
      }
    }

    // 调试日志：显示所有权限检查参数
    console.log("[Doc Access] Permission check params:", {
      documentId: document.id,
      documentUserId: document.userId,
      documentWorkspaceId: document.workspaceId,
      currentUserId: userId,
      currentUserEmail: userEmail,
      workspaceOwnerId,
      workspaceMemberRole,
      workspaceMemberPermission,
      documentCollaboratorPermission,
      documentCollaboratorStatus,
    });

    // 使用统一的权限检查逻辑
    const permissionResult: DocumentPermissionResult = checkDocumentPermission({
      documentId: document.id,
      documentUserId: document.userId,
      documentWorkspaceId: document.workspaceId,
      documentIsPublished: document.isPublished,
      documentDeletedAt: document.deletedAt,
      currentUserId: userId,
      currentUserEmail: userEmail,
      workspaceOwnerId,
      workspaceMemberRole,
      workspaceMemberPermission,
      documentCollaboratorPermission,
      documentCollaboratorStatus,
    });

    console.log("[Doc Access] Permission check result:", {
      documentId,
      userId,
      access: permissionResult.access,
      reason: permissionResult.reason,
    });

    return {
      access: permissionResult.access,
      document,
      hasCollaborators,
      isCurrentUserCollaborator,
    };
  } catch (error) {
    // Document not found or DB error
    throw error;
  }
}
