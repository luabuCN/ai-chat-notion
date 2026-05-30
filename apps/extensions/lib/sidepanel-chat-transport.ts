import { DefaultChatTransport, type UIMessage } from "ai";
import { getApiToken, refreshApiToken } from "@/lib/auth/api-token";
import { API_ORIGIN } from "@/lib/web-config";

/**
 * 与主站 `apps/web/components/chat.tsx` 的 `DefaultChatTransport` 对齐。
 * 使用 Bearer token 认证，不再依赖 Cookie 或主站标签页代理。
 */
export function createSidepanelChatTransport(
  getModelId: () => string,
  getWorkspaceSlug: () => string,
  shouldIncludeSeedSync: () => boolean,
): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport<UIMessage>({
    api: `${API_ORIGIN}/api/chat`,
    credentials: "omit",
    fetch: async (inputUrl, init) => {
      const url =
        typeof inputUrl === "string" ? inputUrl : inputUrl.toString();

      const doFetch = async (token: string) =>
        fetch(url, {
          ...init,
          headers: {
            ...((init?.headers as Record<string, string>) ?? {}),
            Authorization: `Bearer ${token}`,
          },
        });

      let token = await getApiToken();
      if (!token) {
        throw new Error("未登录或无法获取 API Token，请先登录主站。");
      }

      let res = await doFetch(token);
      if (res.status === 401) {
        token = await refreshApiToken();
        if (!token) {
          throw new Error("API Token 已过期，请重新登录主站。");
        }
        res = await doFetch(token);
      }

      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = (await res.json()) as {
            message?: string;
            cause?: string;
          };
          msg = j.message ?? j.cause ?? msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }
      return res;
    },
    prepareSendMessagesRequest: (request) => {
      const modelId = getModelId().trim();
      const isLegacyModelId = modelId.startsWith("chat-model");
      const workspaceSlug = getWorkspaceSlug().trim();
      const lastUser = [...request.messages]
        .filter((m) => m.role === "user")
        .at(-1);
      const includeSeed =
        shouldIncludeSeedSync() && request.messages.length > 1;
      const seedMessages = includeSeed
        ? request.messages
            .slice(0, -1)
            .filter(
              (m): m is UIMessage & { role: "assistant" | "user" } =>
                m.role === "assistant" || m.role === "user",
            )
            .map((m) => ({
              id: m.id,
              parts: m.parts
                .filter((p): p is { text: string; type: "text" } => p.type === "text")
                .map((p) => ({
                  text: p.text.trim(),
                  type: "text" as const,
                }))
                .filter((p) => p.text.length > 0),
              role: m.role,
            }))
            .filter((m) => m.parts.length > 0)
        : undefined;
      const body: Record<string, unknown> = {
        id: request.id,
        message: lastUser ?? request.messages.at(-1),
        selectedModelSlug: isLegacyModelId ? undefined : modelId || undefined,
        ...request.body,
        workspaceSlug: workspaceSlug ? workspaceSlug : undefined,
      };
      if (seedMessages !== undefined && seedMessages.length > 0) {
        body.seedMessages = seedMessages;
      }
      return { body };
    },
  });
}
