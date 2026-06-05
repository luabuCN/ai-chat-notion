import type { Context } from "hono";
import jwt from "jsonwebtoken";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  markNotificationActionTaken,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function listNotificationsHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const typeParam = searchParams.get("type");

    // Support comma-separated types: "DOC_PERMISSION_CHANGED,SPACE_PERMISSION_CHANGED,DOC_REMOVED,SPACE_REMOVED"
    const type = typeParam
      ? typeParam.includes(",")
        ? typeParam.split(",").map((t) => t.trim()) as string[]
        : typeParam
      : undefined;

    const result = await getNotifications({
      userId: session.user.id,
      page,
      pageSize,
      type,
    });

    return c.json(result);
  } catch (error) {
    console.error("Failed to get notifications:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to get notifications"
    ).toResponse();
  }
}

export async function unreadCountHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const count = await getUnreadCount({ userId: session.user.id });
    return c.json({ count });
  } catch (error) {
    console.error("Failed to get unread count:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to get unread count"
    ).toResponse();
  }
}

export async function markAsReadHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const id = c.req.param("id")!;
    await markAsRead({ notificationId: id, userId: session.user.id });
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to mark notification as read"
    ).toResponse();
  }
}

export async function markAllAsReadHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    await markAllAsRead({ userId: session.user.id });
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to mark all as read:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to mark all as read"
    ).toResponse();
  }
}

/**
 * Generate a short-lived JWT for the notification WebSocket connection.
 * Follows the same pattern as POST /api/collab/token.
 */
export async function createWsTokenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return new ApiError("bad_request:api", "Server configuration error").toResponse();
  }

  const token = jwt.sign(
    { userId: session.user.id },
    secret,
    { expiresIn: "24h" }
  );

  return c.json({ token, expiresIn: 24 * 60 * 60 });
}

export async function deleteNotificationHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const id = c.req.param("id")!;
    await deleteNotification({ notificationId: id, userId: session.user.id });
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to delete notification"
    ).toResponse();
  }
}

export async function markActionTakenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const id = c.req.param("id")!;
    await markNotificationActionTaken({
      notificationId: id,
      userId: session.user.id,
    });
    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notification action taken:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to mark notification action taken"
    ).toResponse();
  }
}
