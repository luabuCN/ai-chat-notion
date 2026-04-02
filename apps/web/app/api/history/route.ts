import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  getChatsByUserId,
  deleteAllChatsByUserId,
  getWorkspaceBySlug,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import {
  extensionCorsOptionsResponse,
  withExtensionCors,
} from "@/lib/extension-cors";

export function OPTIONS(request: Request) {
  return extensionCorsOptionsResponse(request) ?? new Response(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");
  const workspaceSlug = searchParams.get("workspace");

  if (startingAfter && endingBefore) {
    return withExtensionCors(
      request,
      new ChatSDKError(
        "bad_request:api",
        "Only one of starting_after or ending_before can be provided."
      ).toResponse(),
    );
  }

  const session = await auth();
  if (!session?.user) {
    return withExtensionCors(
      request,
      new ChatSDKError("unauthorized:chat").toResponse(),
    );
  }

  // 获取 workspace ID
  let workspaceId: string | undefined;
  if (workspaceSlug) {
    const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
    if (workspace) {
      workspaceId = workspace.id;
    }
  }

  const chats = await getChatsByUserId({
    id: session.user.id,
    workspaceId,
    limit,
    startingAfter,
    endingBefore,
  });

  return withExtensionCors(request, Response.json(chats));
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return withExtensionCors(
      request,
      new ChatSDKError("unauthorized:chat").toResponse(),
    );
  }

  const result = await deleteAllChatsByUserId({ userId: session.user.id });

  return withExtensionCors(
    request,
    Response.json(result, { status: 200 }),
  );
}
