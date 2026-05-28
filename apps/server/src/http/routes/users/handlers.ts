import type { Context } from "hono";
import { prisma } from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function getUserHandler(c: Context) {
  const id = c.req.param("id")!;

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
    });

    if (!targetUser) {
      return new ApiError(
        "not_found:document",
        "User not found"
      ).toResponse();
    }

    return c.json(targetUser, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to get user"
    ).toResponse();
  }
}
