import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import {
  assertDocumentCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "@/lib/permission-assert";
import { moveEditorDocument } from "@repo/database";

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
    await assertDocumentCanManage(id, user);

    const { parentDocumentId }: { parentDocumentId: string | null } =
      await request.json();

    if (parentDocumentId) {
      await assertDocumentCanManage(parentDocumentId, user);
    }

    const movedDocument = await moveEditorDocument({
      id,
      parentDocumentId,
    });

    return Response.json(movedDocument, { status: 200 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse(error.message);
    }
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to move editor document"
    ).toResponse();
  }
}
