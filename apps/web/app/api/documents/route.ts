import { auth } from "@/app/(auth)/auth";
import { getDocumentsByUserId } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const documents = await getDocumentsByUserId({ userId: session.user.id });

  return Response.json(documents, { status: 200 });
}

