import { getAuthFromRequest } from "@/lib/api-auth";
import {
  updateEditorDocument,
  softDeleteEditorDocument,
  deleteEditorDocument,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { verifyDocumentAccess } from "@/lib/document-access";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user } = getAuthFromRequest(request);

  try {
    const { access, document } = await verifyDocumentAccess(id, user?.id);

    if (access === "none") {
      if (!user) {
        return new ChatSDKError("unauthorized:document").toResponse();
      }
      return new ChatSDKError("forbidden:document").toResponse();
    }

    return Response.json({ ...document, accessLevel: access }, { status: 200 });
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
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const body = await request.json();
    const {
      title,
      content,
      icon,
      coverImage,
      coverImageType,
      coverImagePosition,
      isPublished,
      isFavorite,
    }: {
      title?: string;
      content?: string;
      icon?: string | null;
      coverImage?: string | null;
      coverImageType?: "color" | "url" | null;
      coverImagePosition?: number | null;
      isPublished?: boolean;
      isFavorite?: boolean;
    } = body;

    const updatedDocument = await updateEditorDocument({
      id,
      title,
      content,
      icon,
      coverImage,
      coverImageType,
      coverImagePosition,
      isPublished,
      isFavorite,
    });

    return Response.json(updatedDocument, { status: 200 });
  } catch (error) {
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
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    if (permanent) {
      await deleteEditorDocument({ id });
    } else {
      await softDeleteEditorDocument({ id });
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to delete editor document"
    ).toResponse();
  }
}
