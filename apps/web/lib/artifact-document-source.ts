import type { ArtifactKind } from "@/components/artifact";
import type { ChatMessage } from "@/lib/types";
import { fetcher } from "@/lib/utils";

export type CreatedArtifactDocument = {
  id: string;
  title: string;
  kind: ArtifactKind;
};

export function findCreatedDocumentInMessage(
  message: ChatMessage
): CreatedArtifactDocument | null {
  for (const part of message.parts ?? []) {
    if (
      part.type === "tool-createDocument" &&
      part.state === "output-available" &&
      part.output &&
      !("error" in part.output) &&
      part.output.id
    ) {
      return {
        id: part.output.id,
        title: part.output.title,
        kind: part.output.kind,
      };
    }
  }

  return null;
}

export function findCreatedDocumentInMessages(
  messages: ChatMessage[],
  upToMessageId?: string
): CreatedArtifactDocument | null {
  const limitIndex = upToMessageId
    ? messages.findIndex((message) => message.id === upToMessageId)
    : messages.length - 1;

  if (limitIndex < 0) {
    return null;
  }

  for (let index = limitIndex; index >= 0; index -= 1) {
    const found = findCreatedDocumentInMessage(messages[index]);
    if (found) {
      return found;
    }
  }

  return null;
}

export async function fetchArtifactDocumentContent(
  documentId: string
): Promise<string | null> {
  const documents = (await fetcher(`/api/document?id=${documentId}`)) as Array<{
    content?: string | null;
  }>;
  const latest = documents?.at(-1);
  return latest?.content ?? null;
}
