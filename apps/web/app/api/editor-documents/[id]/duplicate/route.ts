import { auth } from "@/app/(auth)/auth";
import { duplicateEditorDocument, getEditorDocumentById } from "@repo/database";
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
    // Verify document exists and user owns it
    const document = await getEditorDocumentById({ id });

    if (document.userId !== session.user.id) {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const duplicatedDocument = await duplicateEditorDocument({
      id,
      userId: session.user.id,
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
