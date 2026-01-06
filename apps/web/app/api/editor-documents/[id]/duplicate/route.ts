import { getAuthFromRequest } from "@/lib/api-auth";
import { duplicateEditorDocument } from "@repo/database";
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
    // 验证文档访问权限 - 需要编辑权限才能复制
    const { access } = await verifyDocumentAccess(id, user.id);

    if (access === "none") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    // 只有查看权限也可以复制文档（复制到自己名下）
    const duplicatedDocument = await duplicateEditorDocument({
      id,
      userId: user.id,
    });

    return Response.json(duplicatedDocument, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to duplicate editor document"
    ).toResponse();
  }
}
