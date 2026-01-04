import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { Suggestion } from "./types";

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await prisma.suggestion.createMany({
      data: suggestions,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await prisma.suggestion.findMany({
      where: { documentId },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}
