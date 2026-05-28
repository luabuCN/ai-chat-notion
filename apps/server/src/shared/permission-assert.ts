import { prisma } from "@repo/database";
import {
  verifyDocumentAccess,
  type AccessLevel,
} from "./document-access.js";
import { ApiError } from "./errors.js";

const PERMISSION_CHANGED_CODE = "permission_changed";
const PERMISSION_CHANGED_MESSAGE =
  "Your permission has changed. The current operation cannot continue.";

export class PermissionChangedError extends Error {
  code = PERMISSION_CHANGED_CODE;
  statusCode = 403;

  constructor(message = PERMISSION_CHANGED_MESSAGE) {
    super(message);
    this.name = "PermissionChangedError";
  }
}

export function isPermissionChangedError(
  error: unknown
): error is PermissionChangedError {
  return error instanceof PermissionChangedError;
}

export function permissionChangedResponse(
  message = PERMISSION_CHANGED_MESSAGE
) {
  return Response.json(
    {
      code: PERMISSION_CHANGED_CODE,
      message,
    },
    { status: 403 }
  );
}

type CurrentUser = {
  id?: string;
  email?: string | null;
};

type DocumentAssertOptions = {
  ignoreDeletedAt?: boolean;
};

function hasEditAccess(access: AccessLevel) {
  return access === "owner" || access === "edit";
}

export async function assertDocumentCanView(
  documentId: string,
  user: CurrentUser | null | undefined,
  options?: DocumentAssertOptions
) {
  const access = await verifyDocumentAccess(
    documentId,
    user?.id,
    user?.email ?? undefined,
    options
  );

  if (access.access === "none") {
    throw new PermissionChangedError();
  }

  return access;
}

export async function assertDocumentCanEdit(
  documentId: string,
  user: CurrentUser | null | undefined,
  options?: DocumentAssertOptions
) {
  const access = await verifyDocumentAccess(
    documentId,
    user?.id,
    user?.email ?? undefined,
    options
  );

  if (!hasEditAccess(access.access)) {
    throw new PermissionChangedError();
  }

  return access;
}

export async function assertDocumentCanManage(
  documentId: string,
  user: CurrentUser | null | undefined,
  options?: DocumentAssertOptions
) {
  if (!user?.id) {
    throw new PermissionChangedError();
  }

  const access = await verifyDocumentAccess(
    documentId,
    user.id,
    user.email ?? undefined,
    options
  );

  if (access.access === "owner") {
    return access;
  }

  const workspaceId = access.document?.workspaceId;
  if (workspaceId) {
    await assertWorkspaceCanManage(workspaceId, user.id);
    return access;
  }

  throw new PermissionChangedError();
}

export async function assertWorkspaceCanManage(
  workspaceId: string,
  userId: string | undefined
) {
  if (!userId) {
    throw new PermissionChangedError();
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true },
  });

  if (!workspace) {
    throw new PermissionChangedError();
  }

  if (workspace.ownerId === userId) {
    return { role: "owner", permission: "edit", isOwner: true };
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      role: true,
      permission: true,
    },
  });

  if (member?.role === "admin" || member?.role === "owner") {
    return {
      role: member.role,
      permission: member.permission,
      isOwner: false,
    };
  }

  throw new PermissionChangedError();
}
