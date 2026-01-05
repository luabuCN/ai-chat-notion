import { auth } from "@/app/(auth)/auth";
import { getEditorDocumentById, hasWorkspaceAccess } from "@repo/database";

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentAccessResult {
  access: AccessLevel;
  document: any; // Using any to avoid importing huge Prisma types here, or import EditorDocument
}

export async function verifyDocumentAccess(
  documentId: string
): Promise<DocumentAccessResult> {
  const session = await auth();
  const userId = session?.user?.id;

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
