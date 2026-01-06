import type { NextRequest } from "next/server";
import { getAuthFromRequest } from "@/lib/api-auth";
import {
  getChatsByUserId,
  deleteAllChatsByUserId,
  getWorkspaceBySlug,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");
  const workspaceSlug = searchParams.get("workspace");

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
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
    id: user.id,
    workspaceId,
    limit,
    startingAfter,
    endingBefore,
  });

  return Response.json(chats);
}

export async function DELETE(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const result = await deleteAllChatsByUserId({ userId: user.id });

  return Response.json(result, { status: 200 });
}
