import { auth } from "@/app/(auth)/auth";
import {
  getEditorDocumentById,
  updateEditorDocument,
  softDeleteEditorDocument,
  deleteEditorDocument,
  publishEditorDocument,
  unpublishEditorDocument,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;

  try {
    const document = await getEditorDocumentById({ id });

    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    return Response.json(document, { status: 200 });
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
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;

  try {
    const document = await getEditorDocumentById({ id });

    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const body = await request.json();
    const {
      title,
      content,
      icon,
      coverImage,
      coverImageType,
      isPublished,
    }: {
      title?: string;
      content?: string;
      icon?: string | null;
      coverImage?: string | null;
      coverImageType?: "color" | "url" | null;
      isPublished?: boolean;
    } = body;

    const updatedDocument = await updateEditorDocument({
      id,
      title,
      content,
      icon,
      coverImage,
      coverImageType,
      isPublished,
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
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const permanent = searchParams.get("permanent") === "true";

  try {
    const document = await getEditorDocumentById({ id });

    if (document.userId !== session.user.id) {
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

