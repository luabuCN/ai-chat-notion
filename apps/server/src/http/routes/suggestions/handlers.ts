import type { Context } from "hono";
import { getSuggestionsByDocumentId } from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";

export async function getSuggestionsHandler(c: Context) {
  const searchParams = new URL(c.req.url).searchParams;
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return new ApiError(
      "bad_request:api",
      "Parameter documentId is required."
    ).toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:suggestions").toResponse();
  }

  const suggestions = await getSuggestionsByDocumentId({
    documentId,
  });

  const [suggestion] = suggestions;

  if (!suggestion) {
    return c.json([], 200);
  }

  if (suggestion.userId !== session.user.id) {
    return new ApiError("forbidden:api").toResponse();
  }

  return c.json(suggestions, 200);
}
