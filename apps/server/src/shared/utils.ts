import { formatISO } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import type { UIMessage, UIMessagePart } from "ai";
import type { DBMessage } from "@repo/database";
import type { ChatMessage, ChatTools, CustomUIDataTypes } from "./types.js";

export function generateUUID(): string {
  return uuidv4();
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const attachments = message.attachments as any[];
    const documentRefs =
      attachments
        ?.filter((a: any) => a.type === "document-reference")
        ?.map((a: any) => ({ id: a.id, title: a.title, icon: a.icon })) || [];

    return {
      id: message.id,
      role: message.role as "user" | "assistant" | "system",
      parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
      metadata: {
        createdAt: formatISO(message.createdAt),
        ...(documentRefs.length > 0 ? { documentRefs } : {}),
      },
    };
  });
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { type: "text"; text: string }).text)
    .join("");
}
