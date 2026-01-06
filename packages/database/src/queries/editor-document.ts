import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { EditorDocument } from "./types";

// EditorDocument 相关查询函数

export async function createEditorDocument({
  title,
  content,
  userId,
  workspaceId,
  parentDocumentId,
  icon,
  coverImage,
  coverImageType,
}: {
  title: string;
  content?: string;
  userId: string;
  workspaceId?: string | null;
  parentDocumentId?: string | null;
  icon?: string | null;
  coverImage?: string | null;
  coverImageType?: "color" | "url" | null;
}) {
  try {
    return await prisma.editorDocument.create({
      data: {
        title,
        content: content ?? "",
        userId,
        workspaceId: workspaceId ?? null,
        parentDocumentId: parentDocumentId ?? null,
        icon: icon ?? null,
        coverImage: coverImage ?? null,
        coverImageType: coverImageType ?? "url",
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create editor document"
    );
  }
}

export async function getEditorDocumentById({ id }: { id: string }) {
  try {
    const document = await prisma.editorDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new ChatSDKError(
        "not_found:database",
        `Editor document with id ${id} not found`
      );
    }

    return document as EditorDocument;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get editor document by id"
    );
  }
}

export async function getEditorDocumentsByUserId({
  userId,
  workspaceId,
  parentDocumentId,
  includeDeleted = false,
  onlyDeleted = false,
}: {
  userId: string;
  workspaceId?: string | null;
  parentDocumentId?: string | null;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
}) {
  try {
    const where: any = {
      parentDocumentId: onlyDeleted ? undefined : parentDocumentId ?? null,
      deletedAt: onlyDeleted
        ? { not: null }
        : includeDeleted
        ? undefined
        : null,
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    } else {
      where.userId = userId;
      if (workspaceId === null) {
        where.workspaceId = null;
      }
    }

    return await prisma.editorDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get editor documents by user id"
    );
  }
}

export async function updateEditorDocument({
  id,
  title,
  content,
  icon,
  coverImage,
  coverImageType,
  coverImagePosition,
  isPublished,
  isFavorite,
  lastEditedBy,
  lastEditedByName,
}: {
  id: string;
  title?: string;
  content?: string;
  icon?: string | null;
  coverImage?: string | null;
  coverImageType?: "color" | "url" | null;
  coverImagePosition?: number | null;
  isPublished?: boolean;
  isFavorite?: boolean;
  lastEditedBy?: string;
  lastEditedByName?: string;
}) {
  try {
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;
    if (icon !== undefined) data.icon = icon;
    if (coverImage !== undefined) data.coverImage = coverImage;
    if (coverImageType !== undefined) data.coverImageType = coverImageType;
    if (coverImagePosition !== undefined)
      data.coverImagePosition = coverImagePosition;
    if (isPublished !== undefined) data.isPublished = isPublished;
    if (isFavorite !== undefined) data.isFavorite = isFavorite;
    if (lastEditedBy !== undefined) data.lastEditedBy = lastEditedBy;
    if (lastEditedByName !== undefined)
      data.lastEditedByName = lastEditedByName;

    return await prisma.editorDocument.update({
      where: { id },
      data,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update editor document"
    );
  }
}

export async function softDeleteEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to soft delete editor document"
    );
  }
}

export async function restoreEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { deletedAt: null },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to restore editor document"
    );
  }
}

export async function deleteEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.delete({
      where: { id },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete editor document"
    );
  }
}

export async function publishEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { isPublished: true },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to publish editor document"
    );
  }
}

export async function unpublishEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { isPublished: false },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to unpublish editor document"
    );
  }
}

export async function duplicateEditorDocument({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  try {
    // Get original document
    const original = await prisma.editorDocument.findUnique({
      where: { id },
    });

    if (!original) {
      throw new ChatSDKError(
        "not_found:database",
        `Editor document with id ${id} not found`
      );
    }

    // Verify ownership
    if (original.userId !== userId) {
      throw new ChatSDKError(
        "forbidden:database",
        "You don't have permission to duplicate this document"
      );
    }

    // Create duplicate with " copy" suffix
    return await prisma.editorDocument.create({
      data: {
        title: `${original.title} copy`,
        content: original.content ?? "",
        userId: original.userId,
        parentDocumentId: original.parentDocumentId,
        icon: original.icon,
        coverImage: original.coverImage,
        coverImageType: original.coverImageType,
        coverImagePosition: original.coverImagePosition,
      },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to duplicate editor document"
    );
  }
}

export async function moveEditorDocument({
  id,
  parentDocumentId,
}: {
  id: string;
  parentDocumentId: string | null;
}) {
  try {
    // Prevent moving document to itself
    if (id === parentDocumentId) {
      throw new ChatSDKError(
        "bad_request:database",
        "Cannot move document to itself"
      );
    }

    // Check for circular reference (cannot move to own descendant)
    if (parentDocumentId) {
      let currentParent: string | null = parentDocumentId;
      while (currentParent) {
        if (currentParent === id) {
          throw new ChatSDKError(
            "bad_request:database",
            "Cannot move document to its own descendant"
          );
        }
        const parent: any = await prisma.editorDocument.findUnique({
          where: { id: currentParent },
          select: { parentDocumentId: true },
        });
        currentParent = parent?.parentDocumentId ?? null;
      }
    }

    return await prisma.editorDocument.update({
      where: { id },
      data: { parentDocumentId },
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to move editor document"
    );
  }
}

export async function getEditorDocumentPath(id: string) {
  try {
    const path: string[] = [];
    let currentId = id;

    // Safety break to prevent infinite loops in case of malformed data
    let depth = 0;
    const MAX_DEPTH = 20;

    while (currentId && depth < MAX_DEPTH) {
      const doc = await prisma.editorDocument.findUnique({
        where: { id: currentId },
        select: { id: true, parentDocumentId: true },
      });

      if (!doc) break;

      if (doc.parentDocumentId) {
        path.unshift(doc.parentDocumentId);
        currentId = doc.parentDocumentId;
      } else {
        break;
      }
      depth++;
    }

    return path;
  } catch (error) {
    console.error("Error fetching document path:", error);
    return [];
  }
}
