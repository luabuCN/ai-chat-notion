import { getAuthFromRequest } from "@/lib/api-auth";
import { moveEditorDocument } from "@repo/database";
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
    // 验证文档访问权限 - 需要编辑权限才能移动
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const body = await request.json();
    const { parentDocumentId }: { parentDocumentId: string | null } = body;

    // 如果移动到某个父文档下，验证对父文档也有编辑权限
    if (parentDocumentId) {
      const { access: parentAccess } = await verifyDocumentAccess(
        parentDocumentId,
        user.id
      );
      if (parentAccess !== "owner" && parentAccess !== "edit") {
        return new ChatSDKError("forbidden:document").toResponse();
      }
    }

    const movedDocument = await moveEditorDocument({
      id,
      parentDocumentId,
    });

    return Response.json(movedDocument, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to move editor document"
    ).toResponse();
  }
}
