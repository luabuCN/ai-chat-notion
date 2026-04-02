import { fetchMainSiteApiJson } from "@/lib/main-site-api-fetch";
import type { UIMessage } from "ai";

export type SidepanelChatHistoryItem = {
  id: string;
  title: string;
  createdAt: string;
};

type SidepanelHistoryResponse = {
  chats: SidepanelChatHistoryItem[];
  hasMore: boolean;
};

type SidepanelChatMessagesResponse = {
  chatId: string;
  messages: UIMessage[];
};

function toErrorMessage(statusText: string, fallback: string): string {
  return statusText.trim() ? statusText : fallback;
}

function networkError(): Error {
  return new Error(
    "无法连接主站，请确认主站已启动且扩展已登录，或稍后重试。",
  );
}

export async function fetchSidepanelHistory(
  limit = 50,
  workspaceSlug?: string,
): Promise<SidepanelChatHistoryItem[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const slug = workspaceSlug?.trim();
  if (slug) {
    params.set("workspace", slug);
  }
  const result = await fetchMainSiteApiJson(
    `/api/history?${params.toString()}`,
    "GET",
  );
  if (result.status === 0) {
    throw networkError();
  }
  if (!result.ok) {
    const msg =
      typeof result.json === "object" &&
      result.json !== null &&
      "message" in result.json &&
      typeof (result.json as { message?: unknown }).message === "string"
        ? (result.json as { message: string }).message
        : toErrorMessage(result.statusText, "获取历史记录失败");
    throw new Error(msg);
  }
  const data = result.json as SidepanelHistoryResponse | null;
  if (!data || !Array.isArray(data.chats)) {
    return [];
  }
  return data.chats;
}

export async function deleteAllSidepanelHistory(): Promise<void> {
  const result = await fetchMainSiteApiJson("/api/history", "DELETE");
  if (result.status === 0) {
    throw networkError();
  }
  if (!result.ok) {
    throw new Error(toErrorMessage(result.statusText, "删除全部历史失败"));
  }
}

export async function deleteOneSidepanelHistory(chatId: string): Promise<void> {
  const result = await fetchMainSiteApiJson(
    `/api/chat?id=${encodeURIComponent(chatId)}`,
    "DELETE",
  );
  if (result.status === 0) {
    throw networkError();
  }
  if (!result.ok) {
    throw new Error(toErrorMessage(result.statusText, "删除历史失败"));
  }
}

export async function fetchSidepanelChatMessages(
  chatId: string,
): Promise<UIMessage[]> {
  const result = await fetchMainSiteApiJson(
    `/api/chat/${encodeURIComponent(chatId)}/messages`,
    "GET",
  );
  if (result.status === 0) {
    throw networkError();
  }
  if (!result.ok) {
    throw new Error(toErrorMessage(result.statusText, "获取会话消息失败"));
  }
  const data = result.json as SidepanelChatMessagesResponse | null;
  if (!data || !Array.isArray(data.messages)) {
    return [];
  }
  return data.messages;
}
