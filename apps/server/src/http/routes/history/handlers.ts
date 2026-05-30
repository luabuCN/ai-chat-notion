import type { Context } from "hono";
import {
  deleteAllChatsByUserId,
  getChatsByUserId,
  getWorkspaceBySlug,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function listHistoryHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");
  const workspaceSlug = searchParams.get("workspace");

  if (startingAfter && endingBefore) {
    return new ApiError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided.",
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

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

  return c.json(chats);
}

export async function deleteAllHistoryHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const result = await deleteAllChatsByUserId({ userId: session.user.id });
  return c.json(result);
}
