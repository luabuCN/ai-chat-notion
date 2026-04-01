/** background → 主站 content：在页面内同源 POST /api/chat（Cookie 与主站标签一致） */
export const EXTENSION_CHAT_PROXY_MESSAGE_TYPE =
  "WiseWrite:PROXY_CHAT_POST" as const;

export type ExtensionChatProxyMessage = {
  type: typeof EXTENSION_CHAT_PROXY_MESSAGE_TYPE;
  body: string;
};

export type ProxyChatPostResult = {
  ok: boolean;
  status: number;
  statusText: string;
  body: number[];
  headers: Record<string, string>;
};
