import { auth } from "@/app/(auth)/auth";
import {
  createEditorDocument,
  getEditorDocumentsByUserId,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const parentDocumentId = searchParams.get("parentDocumentId");
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  try {
    const documents = await getEditorDocumentsByUserId({
      userId: session.user.id,
      parentDocumentId: parentDocumentId ?? null,
      includeDeleted,
    });

    return Response.json(documents, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get editor documents"
    ).toResponse();
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const body = await request.json();
    const {
      title,
      content,
      parentDocumentId,
      coverImage,
      coverImageType,
    }: {
      title: string;
      content?: string;
      parentDocumentId?: string | null;
      coverImage?: string | null;
      coverImageType?: "color" | "url" | null;
    } = body;

    if (!title) {
      return new ChatSDKError(
        "bad_request:api",
        "Title is required"
      ).toResponse();
    }

    const document = await createEditorDocument({
      title,
      content,
      userId: session.user.id,
      parentDocumentId: parentDocumentId ?? null,
      coverImage: coverImage ?? null,
      coverImageType: coverImageType ?? "url",
    });

    return Response.json(document, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to create editor document"
    ).toResponse();
  }
}

