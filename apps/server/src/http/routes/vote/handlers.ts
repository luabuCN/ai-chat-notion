import type { Context } from "hono";
import {
  getChatById,
  getVotesByChatId,
  voteMessage,
  hasWorkspaceAccess,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function getVotesHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return new ApiError(
      "bad_request:api",
      "Parameter chatId is required."
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return new ApiError("not_found:chat").toResponse();
  }

  // Allow if owner OR has workspace access
  const isOwner = chat.userId === session.user.id;
  let hasAccess = false;
  if (chat.workspaceId) {
    hasAccess = await hasWorkspaceAccess({
      workspaceId: chat.workspaceId,
      userId: session.user.id,
    });
  }

  if (!isOwner && !hasAccess) {
    return new ApiError("forbidden:vote").toResponse();
  }

  const votes = await getVotesByChatId({ id: chatId });
  return c.json(votes, 200);
}

export async function patchVoteHandler(c: Context) {
  const {
    chatId,
    messageId,
    type,
  }: { chatId: string; messageId: string; type: "up" | "down" } =
    await c.req.json();

  if (!chatId || !messageId || !type) {
    return new ApiError(
      "bad_request:api",
      "Parameters chatId, messageId, and type are required."
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:vote").toResponse();
  }

  const chat = await getChatById({ id: chatId });
  if (!chat) {
    return new ApiError("not_found:vote").toResponse();
  }

  const isOwner = chat.userId === session.user.id;
  let hasAccess = false;
  if (chat.workspaceId) {
    hasAccess = await hasWorkspaceAccess({
      workspaceId: chat.workspaceId,
      userId: session.user.id,
    });
  }

  if (!isOwner && !hasAccess) {
    return new ApiError("forbidden:vote").toResponse();
  }

  await voteMessage({ chatId, messageId, type });
  return c.text("Message voted", 200);
}
