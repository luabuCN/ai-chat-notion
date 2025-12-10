import { auth } from "@/app/(auth)/auth";
import {
  getEditorDocumentById,
  publishEditorDocument,
  unpublishEditorDocument,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function POST(
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

    const updatedDocument = await publishEditorDocument({ id });

    return Response.json(updatedDocument, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to publish editor document"
    ).toResponse();
  }
}

export async function DELETE(
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

    const updatedDocument = await unpublishEditorDocument({ id });

    return Response.json(updatedDocument, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to unpublish editor document"
    ).toResponse();
  }
}

