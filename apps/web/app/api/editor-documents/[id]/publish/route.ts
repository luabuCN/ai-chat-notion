import { getAuthFromRequest } from "@/lib/api-auth";
import { publishEditorDocument, unpublishEditorDocument } from "@repo/database";
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
    // 验证文档访问权限 - 需要编辑权限才能发布
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access !== "owner" && access !== "edit") {
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;

  try {
    // 验证文档访问权限 - 需要编辑权限才能取消发布
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access !== "owner" && access !== "edit") {
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
