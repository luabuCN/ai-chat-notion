import { getEditorDocumentById, hasWorkspaceAccess } from "@repo/database";

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

    // 1. Owner check
    if (document.userId === userId) {
      return { access: "owner", document };
    }

    // 2. Workspace Access Check
    if (document.workspaceId) {
      const hasAccess = await hasWorkspaceAccess({
        workspaceId: document.workspaceId,
        userId,
      });

      if (hasAccess) {
        // Currently assuming all workspace members can edit
        // TODO: specific role check if needed
        return { access: "edit", document };
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
