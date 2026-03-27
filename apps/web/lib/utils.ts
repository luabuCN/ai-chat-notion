import type {
  AssistantModelMessage,
  ToolModelMessage,
  UIMessage,
  UIMessagePart,
} from "ai";
import { type ClassValue, clsx } from "clsx";
import { formatISO } from "date-fns";
import { twMerge } from "tailwind-merge";
import type { DBMessage, Document } from "@repo/database";
import { ChatSDKError, type ErrorCode } from "./errors";
import type { ChatMessage, ChatTools, CustomUIDataTypes } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ChatSDKError("offline:chat");
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== "undefined") {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  return [];
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = ToolModelMessage | AssistantModelMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === "user");
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number
) {
  if (!documents) {
    return new Date();
  }
  if (index > documents.length) {
    return new Date();
  }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) {
    return null;
  }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text
    .replace("<has_function_call>", "")
    .replace(/<(\/?)(invoke|parameter)(?:\s[^>]*)?>/g, (match) =>
      match.replace("<", "&lt;").replace(">", "&gt;")
    );
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => {
    // 从 attachments 中提取文档引用信息
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

/** 从路径解析「文档编辑器」页中的文档 id（…/editor/:id），否则为 null */
export function getEditorDocumentIdFromPathname(pathname: string): string | null {
  const normalized = decodeURIComponent(pathname.replace(/\/$/, "") || "/");
  const m = normalized.match(/\/editor\/([^/]+)$/);
  return m ? m[1] : null;
}

/**
 * 若当前路径为 …/editor/:id，返回对应的编辑器列表页 …/editor；否则为 null。
 * 兼容任意前缀（如 /[locale]/[workspace]/editor/:id 或 /editor/:id）。
 */
export function getEditorListPathFromEditorDocumentPath(
  pathname: string
): string | null {
  const id = getEditorDocumentIdFromPathname(pathname);
  if (!id) {
    return null;
  }
  const normalized = decodeURIComponent(pathname.replace(/\/$/, "") || "/");
  const suffix = `/editor/${id}`;
  if (!normalized.endsWith(suffix)) {
    return null;
  }
  return `${normalized.slice(0, -suffix.length)}/editor`;
}

/** 当前路径是否正在查看给定 id 的编辑器文档（忽略 UUID 大小写） */
export function isPathnameEditorDocument(
  pathname: string,
  documentId: string
): boolean {
  const pathId = getEditorDocumentIdFromPathname(pathname);
  if (pathId) {
    return pathId.toLowerCase() === documentId.toLowerCase();
  }
  const normalized = decodeURIComponent(pathname.replace(/\/$/, "") || "/");
  const suffix = `/editor/${documentId}`;
  return normalized.toLowerCase().endsWith(suffix.toLowerCase());
}

/**
 * 从文档页返回编辑器列表 …/editor；无法从路径解析时用 workspaceSlug 回退。
 */
export function getEditorListPathAfterLeavingDocument(
  pathname: string,
  workspaceSlug: string
): string {
  return (
    getEditorListPathFromEditorDocumentPath(pathname) ??
    (workspaceSlug ? `/${workspaceSlug}/editor` : `/editor`)
  );
}
