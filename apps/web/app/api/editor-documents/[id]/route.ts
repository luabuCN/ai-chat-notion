import { getAuthFromRequest } from "@/lib/api-auth";
import {
  updateEditorDocument,
  softDeleteEditorDocument,
  deleteEditorDocument,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { verifyDocumentAccess } from "@/lib/document-access";
import {
  assertDocumentCanEdit,
  assertDocumentCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "@/lib/permission-assert";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user } = getAuthFromRequest(request);

  try {
    const {
      access,
      document,
      canManage,
      hasCollaborators,
      hasWorkspaceCollaborators,
      isCurrentUserCollaborator,
    } = await verifyDocumentAccess(id, user?.id, user?.email);

    if (access === "none") {
      if (!user) {
        return new ChatSDKError("unauthorized:document").toResponse();
      }
      return new ChatSDKError("forbidden:document").toResponse();
    }

    return Response.json(
      {
        ...document,
        accessLevel: access,
        canManage,
        hasCollaborators,
        hasWorkspaceCollaborators,
        isCurrentUserCollaborator,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get editor document"
    ).toResponse();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;

  try {
    await assertDocumentCanEdit(id, user);

    const body = await request.json();
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
      /** base64 编码的 Yjs 状态快照；显式 `null` 表示清空 */
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

    // 仅在传入字段时才解码：避免 undefined 被当成「清空」
    let yjsState: Buffer | null | undefined;
    if (yjsStateB64 === null) {
      yjsState = null;
    } else if (typeof yjsStateB64 === "string") {
      try {
        yjsState = Buffer.from(yjsStateB64, "base64");
      } catch {
        return new ChatSDKError(
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
      lastEditedBy: user.id,
      lastEditedByName: user.name || "Unknown",
    });

    return Response.json(updatedDocument, { status: 200 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update editor document"
    ).toResponse();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get("permanent") === "true";

  try {
    await assertDocumentCanManage(id, user, {
      ignoreDeletedAt: permanent,
    });

    if (permanent) {
      await deleteEditorDocument({ id });
    } else {
      await softDeleteEditorDocument({ id });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete editor document"
    ).toResponse();
  }
}
