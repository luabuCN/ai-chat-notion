import {
  getEditorDocumentById,
  getWorkspaceMemberPermission,
  prisma,
} from "@repo/database";

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentAccessResult {
  access: AccessLevel;
  document: any; // Using any to avoid importing huge Prisma types here
  hasCollaborators?: boolean; // 是否有访客协作者
}

/**
 * 验证用户对文档的访问权限
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

    if (!userId) {
      // Public access check (if published)
      if (document.isPublished) {
        return { access: "view", document, hasCollaborators };
      }
      return { access: "none", document, hasCollaborators };
    }

    // 1. Owner check - 文档创建者始终有完全权限
    if (document.userId === userId) {
      return { access: "owner", document, hasCollaborators };
    }

    // 2. Workspace Access Check - 根据成员权限返回对应级别
    if (document.workspaceId) {
      const memberInfo = await getWorkspaceMemberPermission({
        workspaceId: document.workspaceId,
        userId,
      });

      if (memberInfo) {
        // 空间所有者拥有完全权限
        if (memberInfo.isOwner) {
          return { access: "owner", document, hasCollaborators };
        }

        // 管理员拥有编辑权限
        if (memberInfo.role === "admin") {
          return { access: "edit", document, hasCollaborators };
        }

        // 普通成员根据 permission 字段判断
        if (memberInfo.permission === "edit") {
          return { access: "edit", document, hasCollaborators };
        }

        // 默认只有查看权限
        return { access: "view", document, hasCollaborators };
      }
    }

    // 3. Document Collaborator Check - 检查访客协作者权限
    if (userEmail) {
      const collaborator = await prisma.documentCollaborator.findUnique({
        where: {
          documentId_email: {
            documentId,
            email: userEmail,
          },
        },
      });

      if (collaborator && collaborator.status === "accepted") {
        if (collaborator.permission === "edit") {
          return { access: "edit", document, hasCollaborators };
        }
        return { access: "view", document, hasCollaborators };
      }
    }

    // 4. Published Check
    if (document.isPublished) {
      return { access: "view", document, hasCollaborators };
    }

    return { access: "none", document, hasCollaborators };
  } catch (error) {
    // Document not found or DB error
    throw error;
  }
}
