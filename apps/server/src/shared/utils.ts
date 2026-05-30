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

export function formatChatStreamError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.trim() : String(error).trim();

  if (message.includes("token limit")) {
    return "引用的文档内容过长，超出了模型的上下文长度限制，请尝试缩短文档内容或换用更长上下文的模型。";
  }

  const lastErrorMatch = message.match(/Last error:\s*(.+)$/i);
  if (lastErrorMatch) {
    return formatChatStreamError(new Error(lastErrorMatch[1]));
  }

  const normalized = message.toLowerCase();
  if (
    normalized.includes("overloaded") ||
    normalized.includes("engine_overloaded") ||
    normalized.includes("try again later")
  ) {
    return "AI 服务当前负载过高，请稍后再试。";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    message.includes("429")
  ) {
    return "请求过于频繁，请稍后再试。";
  }

  if (message.length > 0) {
    return message;
  }

  return "发生错误，请稍后重试。";
}

export function hasAssistantMessageContent(message: ChatMessage | UIMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === "text") {
      return part.text.trim().length > 0;
    }
    if (part.type === "reasoning") {
      return part.text.trim().length > 0 && part.text !== "[REDACTED]";
    }
    return part.type.startsWith("tool-");
  });
}
