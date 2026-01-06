import {
  getEditorDocumentById,
  getWorkspaceMemberPermission,
} from "@repo/database";

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentAccessResult {
  access: AccessLevel;
  document: any; // Using any to avoid importing huge Prisma types here
}

/**
 * 验证用户对文档的访问权限
 * @param documentId 文档ID
 * @param userId 用户ID（从请求头获取，由中间件注入）
 */
export async function verifyDocumentAccess(
  documentId: string,
  userId?: string
): Promise<DocumentAccessResult> {
  try {
    const document = await getEditorDocumentById({ id: documentId });

    if (!userId) {
      // Public access check (if published)
      if (document.isPublished) {
        return { access: "view", document };
      }
      return { access: "none", document };
    }

    // 1. Owner check - 文档创建者始终有完全权限
    if (document.userId === userId) {
      return { access: "owner", document };
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
          return { access: "owner", document };
        }

        // 管理员拥有编辑权限
        if (memberInfo.role === "admin") {
          return { access: "edit", document };
        }

        // 普通成员根据 permission 字段判断
        if (memberInfo.permission === "edit") {
          return { access: "edit", document };
        }

        // 默认只有查看权限
        return { access: "view", document };
      }
    }

    // 3. Published Check
    if (document.isPublished) {
      return { access: "view", document };
    }

    return { access: "none", document };
  } catch (error) {
    // Document not found or DB error
    throw error;
  }
}
