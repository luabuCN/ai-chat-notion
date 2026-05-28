import type { Context } from "hono";
import { getDocumentsByUserId } from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function getDocumentsHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  const documents = await getDocumentsByUserId({ userId: session.user.id });
  return c.json(documents, 200);
}
