import { getAuthFromRequest } from "@/lib/api-auth";
import {
  enablePublicEditEditorDocument,
  disablePublicEditEditorDocument,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { verifyDocumentAccess } from "@/lib/document-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;

  try {
    const { access } = await verifyDocumentAccess(id, user.id, user.email);

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const updatedDocument = await enablePublicEditEditorDocument({ id });

    return Response.json(updatedDocument, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to enable public edit for editor document"
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

  try {
    const { access } = await verifyDocumentAccess(id, user.id, user.email);

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const updatedDocument = await disablePublicEditEditorDocument({ id });

    return Response.json(updatedDocument, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to disable public edit for editor document"
    ).toResponse();
  }
}
