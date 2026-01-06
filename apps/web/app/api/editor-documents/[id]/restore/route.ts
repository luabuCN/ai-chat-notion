import { getAuthFromRequest } from "@/lib/api-auth";
import { restoreEditorDocument } from "@repo/database";
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
    // 验证文档访问权限 - 需要编辑权限才能恢复
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const restoredDocument = await restoreEditorDocument({ id });

    return Response.json(restoredDocument, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to restore document"
    ).toResponse();
  }
}
