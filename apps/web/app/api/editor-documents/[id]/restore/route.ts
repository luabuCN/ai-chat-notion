import { auth } from "@/app/(auth)/auth";
import { restoreEditorDocument, getEditorDocumentById } from "@repo/database";
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

    // Verify ownership
    if (document.userId !== session.user.id) {
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
