import { auth } from "@/app/(auth)/auth";
import { moveEditorDocument, getEditorDocumentById } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { id } = await params;

  try {
    // Verify document exists and user owns it
    const document = await getEditorDocumentById({ id });

    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const body = await request.json();
    const { parentDocumentId }: { parentDocumentId: string | null } = body;

    // If moving to a parent, verify user owns the parent too
    if (parentDocumentId) {
      const parentDocument = await getEditorDocumentById({
        id: parentDocumentId,
      });
      if (parentDocument.userId !== session.user.id) {
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
