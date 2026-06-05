import type { Context } from "hono";
import crypto from "node:crypto";
import { gunzipSync } from "node:zlib";
import {
  createEditorDocument,
  getEditorDocumentById,
  getEditorDocumentsByUserId,
  getWorkspaceBySlug,
  updateEditorDocument,
  softDeleteEditorDocument,
  deleteEditorDocument,
  duplicateEditorDocument,
  moveEditorDocument,
  getEditorDocumentPath,
  enablePublicEditEditorDocument,
  disablePublicEditEditorDocument,
  publishEditorDocument,
  unpublishEditorDocument,
  restoreEditorDocument,
  prisma,
  createNotification,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { broadcast } from "../../../ws/connection-pool.js";
import { ApiError } from "../../../shared/errors.js";
import { isSameEmail } from "../../../shared/utils.js";
import { verifyDocumentAccess } from "../../../shared/document-access.js";
import { verifyWorkspaceAccess } from "../../../shared/workspace-access.js";
import {
  assertDocumentCanEdit,
  assertDocumentCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "../../../shared/permission-assert.js";

function isGzipCompressed(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

function serializeYjsStateForApi(
  yjsState: Buffer | Uint8Array | null | undefined
): string | null {
  if (!yjsState || yjsState.length === 0) {
    return null;
  }
  let buf = Buffer.from(yjsState);
  if (isGzipCompressed(buf)) {
    buf = gunzipSync(buf);
  }
  return buf.toString("base64");
}

function permissionToChinese(perm: string | null | undefined): string {
  switch (perm) {
    case "edit": return "编辑";
    case "view": return "查看";
    default: return perm ?? "查看";
  }
}

// ─── Root CRUD ───────────────────────────────────────────────────────────────

export async function listEditorDocumentsHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const searchParams = new URL(c.req.url).searchParams;
  const parentDocumentId = searchParams.get("parentDocumentId");
  const workspaceId = searchParams.get("workspaceId");
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const onlyDeleted = searchParams.get("onlyDeleted") === "true";

  if (workspaceId) {
    const hasAccess = await verifyWorkspaceAccess(workspaceId, session);
    if (!hasAccess) {
      return new ApiError(
        "unauthorized:document",
        "Access denied"
      ).toResponse();
    }
  }

  try {
    const documents = await getEditorDocumentsByUserId({
      userId: session.user.id,
      workspaceId: workspaceId ?? undefined,
      parentDocumentId: parentDocumentId ?? null,
      includeDeleted,
      onlyDeleted,
    });

    return c.json(documents, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get editor documents"
    ).toResponse();
  }
}

export async function createEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  try {
    const body = await c.req.json();
    const {
      title,
      content,
      workspaceId,
      workspaceSlug,
      parentDocumentId,
      coverImage,
      coverImageType,
      sourcePageUrl,
    }: {
      title: string;
      content?: string;
      workspaceId?: string | null;
      workspaceSlug?: string;
      parentDocumentId?: string | null;
      coverImage?: string | null;
      coverImageType?: "color" | "url" | null;
      sourcePageUrl?: string | null;
    } = body;

    if (!title) {
      return new ApiError(
        "bad_request:api",
        "Title is required"
      ).toResponse();
    }

    let resolvedWorkspaceId = workspaceId ?? null;

    if (!resolvedWorkspaceId && workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
      if (workspace) {
        resolvedWorkspaceId = workspace.id;
      }
    }

    if (!resolvedWorkspaceId && parentDocumentId) {
      try {
        const parentDoc = await getEditorDocumentById({
          id: parentDocumentId,
        });
        resolvedWorkspaceId = parentDoc.workspaceId;
      } catch {
        // Parent doc not found, ignore
      }
    }

    if (resolvedWorkspaceId) {
      const hasAccess = await verifyWorkspaceAccess(
        resolvedWorkspaceId,
        session
      );
      if (!hasAccess) {
        return new ApiError(
          "unauthorized:document",
          "Access denied"
        ).toResponse();
      }
    }

    const document = await createEditorDocument({
      title,
      content,
      userId: session.user.id,
      workspaceId: resolvedWorkspaceId,
      parentDocumentId: parentDocumentId ?? null,
      coverImage: coverImage ?? null,
      coverImageType: coverImageType ?? "url",
      sourcePageUrl,
    });

    return c.json(document, 201);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to create editor document"
    ).toResponse();
  }
}

// ─── All documents (flat list) ───────────────────────────────────────────────

export async function getAllDocumentsHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const searchParams = new URL(c.req.url).searchParams;
  const workspaceId = searchParams.get("workspaceId");
  const parentDocumentId = searchParams.get("parentDocumentId");
  const wantFlat =
    searchParams.get("flat") === "true" || searchParams.get("flat") === "1";

  if (workspaceId) {
    const hasAccess = await verifyWorkspaceAccess(workspaceId, session);
    if (!hasAccess) {
      return new ApiError(
        "unauthorized:document",
        "Access denied"
      ).toResponse();
    }
  }

  try {
    const result: any[] = [];

    // Lazy loading children
    if (parentDocumentId) {
      const children = await getEditorDocumentsByUserId({
        userId: session.user.id,
        workspaceId: workspaceId ?? undefined,
        parentDocumentId,
        includeDeleted: false,
        onlyDeleted: false,
      });

      const childIds = children.map((d) => d.id);
      const childrenCounts = await prisma.editorDocument.groupBy({
        by: ["parentDocumentId"],
        where: {
          parentDocumentId: { in: childIds },
          deletedAt: null,
        },
        _count: true,
      });
      const hasChildrenMap = new Map(
        childrenCounts.map((c) => [c.parentDocumentId, c._count > 0])
      );

      for (const doc of children) {
        result.push({
          id: doc.id,
          title: doc.title,
          icon: doc.icon,
          parentDocumentId: doc.parentDocumentId,
          source: "workspace",
          permission: "edit",
          ownerName: null,
          updatedAt: new Date(doc.updatedAt).toISOString(),
          deletedAt: null,
          hasChildren: hasChildrenMap.get(doc.id) ?? false,
          isFavorite: doc.isFavorite,
        });
      }

      return c.json(result, 200);
    }

    // === Top-level query: aggregate three data sources ===

    // 1. Workspace documents
    if (wantFlat && workspaceId) {
      const workspaceDocsFlat = await prisma.editorDocument.findMany({
        where: {
          workspaceId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          icon: true,
          parentDocumentId: true,
          updatedAt: true,
          isFavorite: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      const flatIds = workspaceDocsFlat.map((d) => d.id);
      const childrenCountsFlat =
        flatIds.length > 0
          ? await prisma.editorDocument.groupBy({
              by: ["parentDocumentId"],
              where: {
                parentDocumentId: { in: flatIds },
                deletedAt: null,
              },
              _count: true,
            })
          : [];
      const flatHasChildrenMap = new Map(
        childrenCountsFlat.map((c) => [c.parentDocumentId, c._count > 0])
      );

      for (const doc of workspaceDocsFlat) {
        result.push({
          id: doc.id,
          title: doc.title,
          icon: doc.icon,
          parentDocumentId: doc.parentDocumentId,
          source: "workspace",
          permission: "edit",
          ownerName: null,
          updatedAt: new Date(doc.updatedAt).toISOString(),
          deletedAt: null,
          hasChildren: flatHasChildrenMap.get(doc.id) ?? false,
          isFavorite: doc.isFavorite,
        });
      }
    } else {
      const workspaceDocs = await getEditorDocumentsByUserId({
        userId: session.user.id,
        workspaceId: workspaceId ?? undefined,
        parentDocumentId: null,
        includeDeleted: false,
        onlyDeleted: false,
      });

      const workspaceDocIds = workspaceDocs.map((d) => d.id);
      const childrenCountsForWorkspace =
        workspaceDocIds.length > 0
          ? await prisma.editorDocument.groupBy({
              by: ["parentDocumentId"],
              where: {
                parentDocumentId: { in: workspaceDocIds },
                deletedAt: null,
              },
              _count: true,
            })
          : [];
      const wsHasChildrenMap = new Map(
        childrenCountsForWorkspace.map((c) => [
          c.parentDocumentId,
          c._count > 0,
        ])
      );

      for (const doc of workspaceDocs) {
        result.push({
          id: doc.id,
          title: doc.title,
          icon: doc.icon,
          parentDocumentId: doc.parentDocumentId,
          source: "workspace",
          permission: "edit",
          ownerName: null,
          updatedAt: new Date(doc.updatedAt).toISOString(),
          deletedAt: null,
          hasChildren: wsHasChildrenMap.get(doc.id) ?? false,
          isFavorite: doc.isFavorite,
        });
      }
    }

    // 2. Shared documents from collaborators
    const collaborators = await prisma.documentCollaborator.findMany({
      where: {
        email: session.user.email,
        status: "accepted",
        document: { deletedAt: null },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            workspaceId: true,
            updatedAt: true,
            isFavorite: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const invitedDocIds = new Set(collaborators.map((c) => c.document.id));

    // Visited public documents
    const visitors = await prisma.documentVisitor.findMany({
      where: {
        userId: session.user.id,
        document: {
          OR: [{ isPublished: true }, { isPubliclyEditable: true }],
          deletedAt: null,
          userId: { not: session.user.id },
          id: { notIn: Array.from(invitedDocIds) },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            workspaceId: true,
            updatedAt: true,
            isFavorite: true,
            isPubliclyEditable: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Filter by current workspace
    const filteredCollab = workspaceId
      ? collaborators.filter((c) => c.document.workspaceId !== workspaceId)
      : collaborators;
    const filteredVisitors = workspaceId
      ? visitors.filter((v) => v.document.workspaceId !== workspaceId)
      : visitors;

    for (const c of filteredCollab) {
      result.push({
        id: c.document.id,
        title: c.document.title,
        icon: c.document.icon,
        parentDocumentId: null,
        source: "shared",
        permission: c.permission,
        ownerName:
          c.document.user.name ||
          c.document.user.email?.split("@")[0] ||
          "Unknown",
        updatedAt: new Date(c.document.updatedAt).toISOString(),
        deletedAt: null,
        hasChildren: false,
        isFavorite: c.document.isFavorite,
      });
    }

    for (const v of filteredVisitors) {
      result.push({
        id: v.document.id,
        title: v.document.title,
        icon: v.document.icon,
        parentDocumentId: null,
        source: "shared",
        permission: v.document.isPubliclyEditable ? "edit" : "view",
        ownerName:
          v.document.user.name ||
          v.document.user.email?.split("@")[0] ||
          "Unknown",
        updatedAt: new Date(v.document.updatedAt).toISOString(),
        deletedAt: null,
        hasChildren: false,
        isFavorite: v.document.isFavorite,
      });
    }

    // 3. Trash documents
    const trashDocs = await getEditorDocumentsByUserId({
      userId: session.user.id,
      workspaceId: workspaceId ?? undefined,
      parentDocumentId: null,
      includeDeleted: false,
      onlyDeleted: true,
    });

    for (const doc of trashDocs) {
      result.push({
        id: doc.id,
        title: doc.title,
        icon: doc.icon,
        parentDocumentId: doc.parentDocumentId,
        source: "trash",
        permission: "edit",
        ownerName: null,
        updatedAt: new Date(doc.updatedAt).toISOString(),
        deletedAt: doc.deletedAt
          ? new Date(doc.deletedAt).toISOString()
          : null,
        hasChildren: false,
        isFavorite: doc.isFavorite,
      });
    }

    // Sort by updatedAt descending
    result.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return c.json(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get all documents"
    ).toResponse();
  }
}

// ─── Shared with me ──────────────────────────────────────────────────────────

export async function getSharedWithMeHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const searchParams = new URL(c.req.url).searchParams;
  const currentWorkspaceId = searchParams.get("workspaceId");

  try {
    // 1. Get documents invited to collaborate
    const collaborators = await prisma.documentCollaborator.findMany({
      where: {
        email: session.user.email,
        status: "accepted",
        document: { deletedAt: null },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            userId: true,
            workspaceId: true,
            updatedAt: true,
            lastEditedByName: true,
            isPublished: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        document: {
          updatedAt: "desc",
        },
      },
    });

    // 2. Get visited public documents (exclude own and invited)
    const invitedDocumentIds = collaborators.map((c) => c.document.id);
    const visitors = await prisma.documentVisitor.findMany({
      where: {
        userId: session.user.id,
        document: {
          OR: [{ isPublished: true }, { isPubliclyEditable: true }],
          deletedAt: null,
          userId: { not: session.user.id },
          id: { notIn: invitedDocumentIds },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            userId: true,
            workspaceId: true,
            updatedAt: true,
            lastEditedByName: true,
            isPublished: true,
            isPubliclyEditable: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        visitedAt: "desc",
      },
    });

    // 3. Filter by current workspace if specified
    let filteredCollaborators = collaborators;
    let filteredVisitors = visitors;

    if (currentWorkspaceId) {
      filteredCollaborators = collaborators.filter(
        (c) => c.document.workspaceId !== currentWorkspaceId
      );
      filteredVisitors = visitors.filter(
        (v) => v.document.workspaceId !== currentWorkspaceId
      );
    }

    // 4. Group by owner
    const groupedByOwner: Record<
      string,
      {
        ownerId: string;
        ownerName: string;
        ownerEmail: string;
        documents: Array<{
          id: string;
          title: string;
          icon: string | null;
          workspaceId: string | null;
          updatedAt: Date;
          lastEditedByName: string | null;
          permission: string;
          isPublic: boolean;
        }>;
      }
    > = {};

    for (const collab of filteredCollaborators) {
      const ownerId = collab.document.userId;
      const ownerEmail = collab.document.user.email || "";
      const ownerName =
        collab.document.user.name ||
        ownerEmail.split("@")[0] ||
        "Unknown";

      if (!groupedByOwner[ownerId]) {
        groupedByOwner[ownerId] = {
          ownerId,
          ownerName,
          ownerEmail,
          documents: [],
        };
      }

      groupedByOwner[ownerId].documents.push({
        id: collab.document.id,
        title: collab.document.title,
        icon: collab.document.icon,
        workspaceId: collab.document.workspaceId,
        updatedAt: collab.document.updatedAt,
        lastEditedByName: collab.document.lastEditedByName,
        permission: collab.permission,
        isPublic: false,
      });
    }

    for (const visitor of filteredVisitors) {
      const ownerId = visitor.document.userId;
      const ownerEmail = visitor.document.user.email || "";
      const ownerName =
        visitor.document.user.name || ownerEmail.split("@")[0] || "Unknown";

      if (!groupedByOwner[ownerId]) {
        groupedByOwner[ownerId] = {
          ownerId,
          ownerName,
          ownerEmail,
          documents: [],
        };
      }

      groupedByOwner[ownerId].documents.push({
        id: visitor.document.id,
        title: visitor.document.title,
        icon: visitor.document.icon,
        workspaceId: visitor.document.workspaceId,
        updatedAt: visitor.document.updatedAt,
        lastEditedByName: visitor.document.lastEditedByName,
        permission: visitor.document.isPubliclyEditable ? "edit" : "view",
        isPublic: true,
      });
    }

    // 5. Convert to array and sort by document count
    const result = Object.values(groupedByOwner).sort(
      (a, b) => b.documents.length - a.documents.length
    );

    return c.json(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get shared documents"
    ).toResponse();
  }
}

// ─── Single document CRUD ────────────────────────────────────────────────────

export async function getEditorDocumentHandler(c: Context) {
  const id = c.req.param("id")!;
  const session = await getSessionFromRequest(c.req.raw);

  try {
    const {
      access,
      document,
      canManage,
      hasCollaborators,
      hasWorkspaceCollaborators,
      isCurrentUserCollaborator,
    } = await verifyDocumentAccess(
      id,
      session?.user.id,
      session?.user.email,
      { ignoreDeletedAt: true }
    );

    if (document?.deletedAt) {
      const canViewTrash = access === "owner" || canManage;
      if (!canViewTrash) {
        if (!session) {
          return new ApiError("unauthorized:document").toResponse();
        }
        return new ApiError("forbidden:document", "document_deleted").toResponse();
      }
    }

    if (access === "none") {
      if (!session) {
        return new ApiError("unauthorized:document").toResponse();
      }
      return new ApiError("forbidden:document").toResponse();
    }

    const { yjsState: yjsStateBuffer, ...documentFields } = document;

    return c.json(
      {
        ...documentFields,
        yjsState: serializeYjsStateForApi(yjsStateBuffer),
        accessLevel: access,
        canManage,
        hasCollaborators,
        hasWorkspaceCollaborators,
        isCurrentUserCollaborator,
      },
      200
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get editor document"
    ).toResponse();
  }
}

export async function updateEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanEdit(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const body = await c.req.json();
    const {
      title,
      content,
      yjsState: yjsStateB64,
      icon,
      coverImage,
      coverImageType,
      coverImagePosition,
      isPublished,
      isFavorite,
      sourcePdfUrl,
      sourcePageUrl,
    }: {
      title?: string;
      content?: string;
      yjsState?: string | null;
      icon?: string | null;
      coverImage?: string | null;
      coverImageType?: "color" | "url" | null;
      coverImagePosition?: number | null;
      isPublished?: boolean;
      isFavorite?: boolean;
      sourcePdfUrl?: string | null;
      sourcePageUrl?: string | null;
    } = body;

    // Only decode when explicitly passed
    let yjsState: Buffer | null | undefined;
    if (yjsStateB64 === null) {
      yjsState = null;
    } else if (typeof yjsStateB64 === "string") {
      try {
        yjsState = Buffer.from(yjsStateB64, "base64");
      } catch {
        return new ApiError(
          "bad_request:api",
          "yjsState must be a valid base64 string"
        ).toResponse();
      }
    }

    const updatedDocument = await updateEditorDocument({
      id,
      title,
      content,
      yjsState,
      icon,
      coverImage,
      coverImageType,
      coverImagePosition,
      isPublished,
      isFavorite,
      sourcePdfUrl,
      sourcePageUrl,
      lastEditedBy: session.user.id,
      lastEditedByName: session.user.name || "Unknown",
    });

    return c.json(updatedDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to update editor document"
    ).toResponse();
  }
}

export async function deleteEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;
  const searchParams = new URL(c.req.url).searchParams;
  const permanent = searchParams.get("permanent") === "true";

  try {
    await assertDocumentCanManage(
      id,
      { id: session.user.id, email: session.user.email },
      { ignoreDeletedAt: permanent }
    );

    if (permanent) {
      await deleteEditorDocument({ id });
    } else {
      await softDeleteEditorDocument({ id });
    }

    return c.json({ success: true }, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to delete editor document"
    ).toResponse();
  }
}

// ─── Collaborators ───────────────────────────────────────────────────────────

export async function getCollaboratorsHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documentId = c.req.param("id")!;

  try {
    const { access } = await verifyDocumentAccess(
      documentId,
      session.user.id,
      session.user.email
    );

    if (access !== "owner" && access !== "edit") {
      return new ApiError("forbidden:document").toResponse();
    }

    const collaborators = await prisma.documentCollaborator.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });

    return c.json(collaborators, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get collaborators"
    ).toResponse();
  }
}

export async function addCollaboratorHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documentId = c.req.param("id")!;

  try {
    await assertDocumentCanManage(documentId, {
      id: session.user.id,
      email: session.user.email,
    });

    const { email, permission = "edit" } = (await c.req.json()) as {
      email?: string;
      permission?: "view" | "edit";
    };

    if (!email) {
      return new ApiError(
        "bad_request:api",
        "Email is required"
      ).toResponse();
    }

    if (isSameEmail(email, session.user.email)) {
      return new ApiError(
        "bad_request:api",
        "不能邀请自己的邮箱"
      ).toResponse();
    }

    const existing = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
    });

    if (existing) {
      return new ApiError(
        "bad_request:api",
        "This user has already been invited"
      ).toResponse();
    }

    const invitedUser = await prisma.user.findFirst({
      where: { email },
    });

    const token = crypto.randomBytes(32).toString("hex");

    const collaborator = await prisma.documentCollaborator.create({
      data: {
        documentId,
        email,
        userId: invitedUser?.id,
        permission,
        status: "pending",
        invitedBy: session.user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
      },
    });

    // Send notification to the invited user if they have an account
    if (invitedUser) {
      const doc = await prisma.editorDocument.findUnique({
        where: { id: documentId },
        select: { title: true },
      });

      const notification = await createNotification({
        receiverId: invitedUser.id,
        senderId: session.user.id,
        type: "DOC_SHARE",
        title: `${session.user.name} 分享了文档给你`,
        content: doc?.title ?? null,
        payload: {
          documentId,
          documentTitle: doc?.title,
          inviteToken: token,
        },
      });

      broadcast(invitedUser.id, {
        type: "new_notification",
        notification,
      });
    }

    return c.json(collaborator, 201);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to invite collaborator"
    ).toResponse();
  }
}

export async function updateCollaboratorHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documentId = c.req.param("id")!;

  try {
    await assertDocumentCanManage(documentId, {
      id: session.user.id,
      email: session.user.email,
    });

    const { email, permission } = (await c.req.json()) as {
      email?: string;
      permission?: "view" | "edit";
    };

    if (!email || !permission || !["view", "edit"].includes(permission)) {
      return new ApiError(
        "bad_request:api",
        "Email and permission are required"
      ).toResponse();
    }

    const existingCollaborator = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_email: { documentId, email },
      },
    });

    const collaborator = await prisma.documentCollaborator.update({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
      data: { permission },
    });

    // Notify the collaborator about permission change
    if (collaborator.userId) {
      const doc = await prisma.editorDocument.findUnique({
        where: { id: documentId },
        select: { title: true },
      });

      const notification = await createNotification({
        receiverId: collaborator.userId,
        senderId: session.user.id,
        type: "DOC_PERMISSION_CHANGED",
        title: `你的文档权限已变更`,
        content: `${doc?.title ?? "文档"}: ${permissionToChinese(existingCollaborator?.permission)} → ${permissionToChinese(permission)}`,
        payload: {
          documentId,
          documentTitle: doc?.title,
          oldPermission: existingCollaborator?.permission,
          newPermission: permission,
        },
      });

      broadcast(collaborator.userId, {
        type: "new_notification",
        notification,
      });
    }

    return c.json(collaborator, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to update collaborator"
    ).toResponse();
  }
}

export async function removeCollaboratorHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documentId = c.req.param("id")!;
  const searchParams = new URL(c.req.url).searchParams;
  const email = searchParams.get("email");

  if (!email) {
    return new ApiError(
      "bad_request:api",
      "Email is required"
    ).toResponse();
  }

  try {
    await assertDocumentCanManage(documentId, {
      id: session.user.id,
      email: session.user.email,
    });

    const collaboratorToRemove = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_email: { documentId, email },
      },
    });

    await prisma.documentCollaborator.delete({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
    });

    // Notify the removed collaborator
    if (collaboratorToRemove?.userId) {
      const doc = await prisma.editorDocument.findUnique({
        where: { id: documentId },
        select: { title: true },
      });

      const notification = await createNotification({
        receiverId: collaboratorToRemove.userId,
        senderId: session.user.id,
        type: "DOC_REMOVED",
        title: `你已被移出文档`,
        content: doc?.title ?? null,
        payload: {
          documentId,
          documentTitle: doc?.title,
        },
      });

      broadcast(collaboratorToRemove.userId, {
        type: "new_notification",
        notification,
      });
    }

    return c.json({ success: true }, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to remove collaborator"
    ).toResponse();
  }
}

// ─── Duplicate ───────────────────────────────────────────────────────────────

export async function duplicateEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const duplicatedDocument = await duplicateEditorDocument({
      id,
      userId: session.user.id,
    });

    return c.json(duplicatedDocument, 201);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to duplicate editor document"
    ).toResponse();
  }
}

// ─── Move ────────────────────────────────────────────────────────────────────

export async function moveEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const { parentDocumentId }: { parentDocumentId: string | null } =
      await c.req.json();

    if (parentDocumentId) {
      await assertDocumentCanManage(parentDocumentId, {
        id: session.user.id,
        email: session.user.email,
      });
    }

    const movedDocument = await moveEditorDocument({
      id,
      parentDocumentId,
    });

    return c.json(movedDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to move editor document"
    ).toResponse();
  }
}

// ─── Path ────────────────────────────────────────────────────────────────────

export async function getEditorDocumentPathHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    const { access, document, canManage } = await verifyDocumentAccess(
      id,
      session.user.id,
      session.user.email,
      { ignoreDeletedAt: true }
    );

    if (document?.deletedAt) {
      const canViewTrash = access === "owner" || canManage;
      if (!canViewTrash) {
        return new ApiError("forbidden:document").toResponse();
      }
    }

    if (access === "none") {
      return new ApiError("forbidden:document").toResponse();
    }

    const path = await getEditorDocumentPath(id);
    return c.json(path);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get document path"
    ).toResponse();
  }
}

// ─── Public Edit ─────────────────────────────────────────────────────────────

export async function enablePublicEditHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const updatedDocument = await enablePublicEditEditorDocument({ id });
    return c.json(updatedDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to enable public edit for editor document"
    ).toResponse();
  }
}

export async function disablePublicEditHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const updatedDocument = await disablePublicEditEditorDocument({ id });
    return c.json(updatedDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to disable public edit for editor document"
    ).toResponse();
  }
}

// ─── Publish ─────────────────────────────────────────────────────────────────

export async function publishEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const updatedDocument = await publishEditorDocument({ id });
    return c.json(updatedDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to publish editor document"
    ).toResponse();
  }
}

export async function unpublishEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(id, {
      id: session.user.id,
      email: session.user.email,
    });

    const updatedDocument = await unpublishEditorDocument({ id });
    return c.json(updatedDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to unpublish editor document"
    ).toResponse();
  }
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export async function restoreEditorDocumentHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const id = c.req.param("id")!;

  try {
    await assertDocumentCanManage(
      id,
      { id: session.user.id, email: session.user.email },
      { ignoreDeletedAt: true }
    );

    const restoredDocument = await restoreEditorDocument({ id });
    return c.json(restoredDocument, 200);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to restore document"
    ).toResponse();
  }
}

// ─── Visit ───────────────────────────────────────────────────────────────────

export async function recordVisitHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documentId = c.req.param("id")!;

  try {
    const document = await prisma.editorDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        isPublished: true,
        isPubliclyEditable: true,
        userId: true,
      },
    });

    if (!document) {
      return new ApiError("not_found:document").toResponse();
    }

    // Only track public documents that aren't the user's own
    const isPublic = document.isPublished || document.isPubliclyEditable;
    if (!isPublic || document.userId === session.user.id) {
      return c.json({ success: true, tracked: false }, 200);
    }

    await prisma.documentVisitor.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: session.user.id,
        },
      },
      update: {
        visitedAt: new Date(),
      },
      create: {
        documentId,
        userId: session.user.id,
      },
    });

    return c.json({ success: true, tracked: true }, 200);
  } catch (error) {
    console.error("[Visit] Error recording visit:", error);
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to record document visit"
    ).toResponse();
  }
}

// ─── Collaborator Invite (token-based) ───────────────────────────────────────

export async function getCollaboratorInviteHandler(c: Context) {
  const token = c.req.param("token")!;

  try {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: { token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
          },
        },
      },
    });

    if (!collaborator) {
      return new ApiError(
        "not_found:document",
        "Invite not found"
      ).toResponse();
    }

    if (collaborator.expiresAt && collaborator.expiresAt < new Date()) {
      return new ApiError(
        "bad_request:api",
        "Invite expired"
      ).toResponse();
    }

    return c.json(
      {
        email: collaborator.email,
        permission: collaborator.permission,
        status: collaborator.status,
        document: collaborator.document,
      },
      200
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get invite"
    ).toResponse();
  }
}

export async function acceptCollaboratorInviteHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const token = c.req.param("token")!;

  try {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: { token },
    });

    if (!collaborator) {
      return new ApiError(
        "not_found:document",
        "Invite not found"
      ).toResponse();
    }

    if (collaborator.email !== session.user.email) {
      return new ApiError(
        "forbidden:document",
        "This invite is not for you"
      ).toResponse();
    }

    if (collaborator.expiresAt && collaborator.expiresAt < new Date()) {
      return new ApiError(
        "bad_request:api",
        "Invite expired"
      ).toResponse();
    }

    if (collaborator.status === "accepted") {
      return c.json(
        { success: true, documentId: collaborator.documentId },
        200
      );
    }

    await prisma.documentCollaborator.update({
      where: { id: collaborator.id },
      data: {
        status: "accepted",
        userId: session.user.id,
        acceptedAt: new Date(),
      },
    });

    return c.json(
      { success: true, documentId: collaborator.documentId },
      200
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to accept invite"
    ).toResponse();
  }
}
