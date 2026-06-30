import {
  getEditorDocumentMetadataById,
  getWorkspaceMemberPermission,
  prisma,
} from "@repo/database";
import {
  checkDocumentPermission,
  type DocumentPermissionResult,
} from "./permissions.js";

export type AccessLevel = "owner" | "edit" | "view" | "none";

export interface DocumentAccessResult {
  access: AccessLevel;
  document: any;
  canManage?: boolean;
  hasCollaborators?: boolean;
  hasWorkspaceCollaborators?: boolean;
  isCurrentUserCollaborator?: boolean;
}

/**
 * Verify user's access to a document (server-side).
 *
 * Uses the unified funnel model permission check logic.
 *
 * @param documentId Document ID
 * @param userId User ID
 * @param userEmail User email (for collaborator check)
 * @param options.ignoreDeletedAt When true, don't deny access due to soft-delete
 */
export async function verifyDocumentAccess(
  documentId: string,
  userId?: string,
  userEmail?: string,
  options?: { ignoreDeletedAt?: boolean }
): Promise<DocumentAccessResult> {
  try {
    const document = await getEditorDocumentMetadataById({ id: documentId });

    // Check if there are collaborators (for determining collab edit availability)
    const collaboratorCount = await prisma.documentCollaborator.count({
      where: {
        documentId,
        status: {
          in: ["pending", "accepted"],
        },
      },
    });
    const hasCollaborators = collaboratorCount > 0;

    // Get workspace info
    let workspaceOwnerId: string | undefined;
    let workspaceMemberRole: string | undefined;
    let workspaceMemberPermission: string | undefined;
    let hasWorkspaceCollaborators = false;

    if (document.workspaceId && userId) {
      const [workspace, workspaceMembers] = await Promise.all([
        prisma.workspace.findUnique({
          where: { id: document.workspaceId },
          select: { ownerId: true },
        }),
        prisma.workspaceMember.findMany({
          where: { workspaceId: document.workspaceId },
          select: { userId: true },
        }),
      ]);
      workspaceOwnerId = workspace?.ownerId;
      const workspaceMemberIds = workspaceMembers.map((member) => member.userId);
      const workspaceUserIds = new Set(
        [workspaceOwnerId, ...workspaceMemberIds].filter(Boolean)
      );
      hasWorkspaceCollaborators = workspaceUserIds.size > 1;

      const memberInfo = await getWorkspaceMemberPermission({
        workspaceId: document.workspaceId,
        userId,
      });

      if (memberInfo) {
        workspaceMemberRole = memberInfo.role;
        workspaceMemberPermission = memberInfo.permission;
      }
    }

    // Get document collaborator info
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
      }
    }

    // Use unified permission check logic
    const permissionResult: DocumentPermissionResult = checkDocumentPermission({
      documentId: document.id,
      documentUserId: document.userId,
      documentWorkspaceId: document.workspaceId,
      documentIsPublished: document.isPublished,
      documentIsPubliclyEditable:
        (document as any).isPubliclyEditable ?? false,
      documentDeletedAt: document.deletedAt,
      ignoreDeletedAt: options?.ignoreDeletedAt === true,
      currentUserId: userId,
      currentUserEmail: userEmail,
      workspaceOwnerId,
      workspaceMemberRole,
      workspaceMemberPermission,
      documentCollaboratorPermission,
      documentCollaboratorStatus,
    });

    const canManage =
      permissionResult.access === "owner" ||
      workspaceMemberRole === "admin" ||
      workspaceMemberRole === "owner";

    return {
      access: permissionResult.access,
      document,
      canManage,
      hasCollaborators,
      hasWorkspaceCollaborators,
      isCurrentUserCollaborator,
    };
  } catch (error) {
    // Document not found or DB error
    throw error;
  }
}
