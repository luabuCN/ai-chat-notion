import type { Context } from "hono";
import { getUserTokenQuota } from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function getTokenUsageHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const quota = await getUserTokenQuota({ userId: session.user.id });
  return c.json(quota);
}
