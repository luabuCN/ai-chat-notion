import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagesByChatId } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import {
  extensionCorsOptionsResponse,
  withExtensionCors,
} from "@/lib/extension-cors";
import { convertToUIMessages } from "@/lib/utils";

export function OPTIONS(request: Request) {
  return extensionCorsOptionsResponse(request) ?? new Response(null, { status: 204 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return withExtensionCors(
      request,
      new ChatSDKError("bad_request:api").toResponse(),
    );
  }

  const session = await auth();
  if (!session?.user) {
    return withExtensionCors(
      request,
      new ChatSDKError("unauthorized:chat").toResponse(),
    );
  }

  const chat = await getChatById({ id });
  if (!chat) {
    return withExtensionCors(
      request,
      new ChatSDKError("not_found:chat").toResponse(),
    );
  }
  if (chat.userId !== session.user.id) {
    return withExtensionCors(
      request,
      new ChatSDKError("forbidden:chat").toResponse(),
    );
  }

  const messages = await getMessagesByChatId({ id });
  return withExtensionCors(
    request,
    Response.json({
      chatId: id,
      messages: convertToUIMessages(messages),
    }),
  );
}
