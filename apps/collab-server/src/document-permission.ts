/**
 * Document permission calculation.
 *
 * Current model:
 * - A document belongs to one workspace at most.
 * - Workspace membership grants inherited permission: view or edit.
 * - Direct document sharing grants document-level permission: view or edit.
 * - If a user has both workspace and direct-share permission, the effective
 *   permission is the stricter one.
 */

export type AccessLevel = "owner" | "edit" | "view" | "none";

type GrantLevel = Exclude<AccessLevel, "owner">;

export interface DocumentPermissionParams {
  documentId: string;
  documentUserId: string;
  documentWorkspaceId: string | null;
  /** Public read-only publishing: anonymous users can view. */
  documentIsPublished: boolean;
  /** Public editing link: users without other grants can edit. */
  documentIsPubliclyEditable?: boolean;
  documentDeletedAt: Date | null;
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
  reason: string;
}

const permissionRank: Record<GrantLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
};

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

  if (documentDeletedAt && !ignoreDeletedAt) {
    return createPermissionResult("none", "Document is deleted");
  }

  if (!currentUserId) {
    if (documentIsPubliclyEditable) {
      return createPermissionResult("edit", "Publicly editable document");
    }
    if (documentIsPublished) {
      return createPermissionResult("view", "Public published document");
    }
    return createPermissionResult("none", "Not authenticated");
  }

  if (documentUserId === currentUserId) {
    return createPermissionResult("owner", "Document owner", true);
  }

  if (documentWorkspaceId && workspaceOwnerId === currentUserId) {
    return createPermissionResult("owner", "Workspace owner", true);
  }

  const workspaceAccess = getWorkspaceAccess({
    hasWorkspace: Boolean(documentWorkspaceId),
    workspaceMemberRole,
    workspaceMemberPermission,
  });

  const shareAccess = getDocumentShareAccess({
    currentUserEmail,
    documentCollaboratorPermission,
    documentCollaboratorStatus,
  });

  const isCollaborator = Boolean(shareAccess);
  const effectiveAccess = getEffectiveAccess(workspaceAccess, shareAccess);

  if (effectiveAccess) {
    return createPermissionResult(
      effectiveAccess,
      getEffectiveReason(workspaceAccess, shareAccess, effectiveAccess),
      false,
      isCollaborator
    );
  }

  if (documentIsPubliclyEditable) {
    return createPermissionResult("edit", "Publicly editable document");
  }

  if (documentIsPublished) {
    return createPermissionResult("view", "Public published document");
  }

  return createPermissionResult("none", "No permission");
}

function getWorkspaceAccess(params: {
  hasWorkspace: boolean;
  workspaceMemberRole?: string;
  workspaceMemberPermission?: string;
}): GrantLevel | undefined {
  const { hasWorkspace, workspaceMemberRole, workspaceMemberPermission } =
    params;

  if (!hasWorkspace) {
    return undefined;
  }

  if (workspaceMemberRole === "admin") {
    return "edit";
  }

  return normalizeGrant(workspaceMemberPermission);
}

function getDocumentShareAccess(params: {
  currentUserEmail?: string;
  documentCollaboratorPermission?: string;
  documentCollaboratorStatus?: string;
}): GrantLevel | undefined {
  const {
    currentUserEmail,
    documentCollaboratorPermission,
    documentCollaboratorStatus,
  } = params;

  if (!currentUserEmail || documentCollaboratorStatus !== "accepted") {
    return undefined;
  }

  return normalizeGrant(documentCollaboratorPermission);
}

function getEffectiveAccess(
  workspaceAccess?: GrantLevel,
  shareAccess?: GrantLevel
): GrantLevel | undefined {
  if (workspaceAccess && shareAccess) {
    return permissionRank[workspaceAccess] <= permissionRank[shareAccess]
      ? workspaceAccess
      : shareAccess;
  }

  return workspaceAccess ?? shareAccess;
}

function normalizeGrant(permission?: string): GrantLevel | undefined {
  if (permission === "edit") {
    return "edit";
  }

  if (
    permission === "view" ||
    permission === "read" ||
    permission === "comment"
  ) {
    return "view";
  }

  return undefined;
}

function getEffectiveReason(
  workspaceAccess: GrantLevel | undefined,
  shareAccess: GrantLevel | undefined,
  effectiveAccess: GrantLevel
): string {
  if (workspaceAccess && shareAccess) {
    return `Stricter of workspace (${workspaceAccess}) and document share (${shareAccess})`;
  }

  if (workspaceAccess) {
    return `Workspace member (${effectiveAccess})`;
  }

  return `Document collaborator (${effectiveAccess})`;
}

function createPermissionResult(
  access: AccessLevel,
  reason: string,
  isOwner = false,
  isCollaborator = false
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
