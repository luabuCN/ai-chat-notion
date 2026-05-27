import jwt from "jsonwebtoken";
import type { Context } from "hono";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import { verifyDocumentAccess } from "../../../collab/auth.js";
import { collabTokenBodySchema } from "./schema.js";

export async function createTokenHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:document").toResponse();
  }

  try {
    const json = await c.req.json();
    const parsed = collabTokenBodySchema.safeParse(json);

    if (!parsed.success) {
      return new ApiError("bad_request:api", "Document ID is required").toResponse();
    }

    const { documentId } = parsed.data;

    const { access } = await verifyDocumentAccess(
      documentId,
      session.user.id,
      session.user.email,
    );

    if (access === "none") {
      return new ApiError("forbidden:document").toResponse();
    }

    const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      console.error("Missing AUTH_SECRET or JWT_SECRET");
      return new ApiError(
        "bad_request:api",
        "Server configuration error",
      ).toResponse();
    }

    const token = jwt.sign(
      {
        userId: session.user.id,
        email: session.user.email,
        name:
          session.user.name ||
          session.user.email?.split("@")[0] ||
          "Anonymous",
        documentId,
        accessLevel: access,
      },
      secret,
      { expiresIn: "24h" },
    );

    return c.json({
      token,
      accessLevel: access,
      expiresIn: 24 * 60 * 60,
    });
  } catch (error) {
    console.error("Failed to generate collab token:", error);
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    return new ApiError(
      "bad_request:api",
      "Failed to generate collaboration token",
    ).toResponse();
  }
}
