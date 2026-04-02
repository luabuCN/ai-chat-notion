import { DefaultChatTransport, type UIMessage } from "ai";
import { proxyChatPostViaMainSiteTab } from "@/lib/auth/proxy-chat-post-via-tab";
import {
  webFetchJsonErrorBody,
  webFetchWithMainSiteCookies,
} from "@/lib/web-fetch";
import { WEB_ORIGIN } from "@/lib/web-config";

/**
 * 与主站 `apps/web/components/chat.tsx` 的 `DefaultChatTransport` 对齐。
 * 会话标题与入库由主站 `POST /api/chat` 完成（新会话：`generateTitleFromUserMessage` + `saveChat`；
 * 用户消息：`saveMessages`；流结束：再次 `saveMessages` 等），扩展只需发同一套 body。
 *
 * `getModelId` 在每次请求时调用，避免 ref 未同步导致 `selectedModelSlug` 为空。
 */
export function createSidepanelChatTransport(
  getModelId: () => string,
  getWorkspaceSlug: () => string,
): DefaultChatTransport<UIMessage> {
  return new DefaultChatTransport<UIMessage>({
    api: `${WEB_ORIGIN}/api/chat`,
    credentials: "omit",
    fetch: async (inputUrl, init) => {
      const url =
        typeof inputUrl === "string" ? inputUrl : inputUrl.toString();
      const bodyString =
        typeof init?.body === "string" ? init.body : undefined;
      const isChatPost =
        url.includes("/api/chat") &&
        init?.method === "POST" &&
        bodyString !== undefined;

      function responseFromProxiedBuffer(
        proxied: NonNullable<
          Awaited<ReturnType<typeof proxyChatPostViaMainSiteTab>>
        >,
      ): Response {
        const uint8 = new Uint8Array(proxied.body);
        if (!proxied.ok) {
          let msg = proxied.statusText;
          try {
            const text = new TextDecoder().decode(uint8);
            const j = JSON.parse(text) as {
              message?: string;
              cause?: string;
            };
            msg = j.message ?? j.cause ?? msg;
          } catch {
            // ignore
          }
          throw new Error(msg);
        }
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(uint8);
            controller.close();
          },
        });
        return new Response(stream, {
          status: proxied.status,
          statusText: proxied.statusText,
          headers: new Headers(proxied.headers),
        });
      }

      /** 直连可保留 SSE 流式；代理整包读 body，仅作 401 / 跨域失败时的回退。 */
      if (isChatPost) {
        let res: Response;
        try {
          res = await webFetchWithMainSiteCookies(url, init);
        } catch {
          const proxied = await proxyChatPostViaMainSiteTab(bodyString);
          if (proxied !== null) {
            return responseFromProxiedBuffer(proxied);
          }
          throw new Error(
            "无法连接主站接口，请确认网络与扩展有权访问主站，或打开主站标签页后重试。",
          );
        }
        if (res.status === 401) {
          const errJson = await webFetchJsonErrorBody(res);
          const proxied = await proxyChatPostViaMainSiteTab(bodyString);
          if (proxied !== null) {
            return responseFromProxiedBuffer(proxied);
          }
          throw new Error(
            errJson.message ?? errJson.cause ?? res.statusText,
          );
        }
        if (!res.ok) {
          const j = await webFetchJsonErrorBody(res);
          throw new Error(j.message ?? j.cause ?? res.statusText);
        }
        return res;
      }

      const res = await webFetchWithMainSiteCookies(url, init);
      if (!res.ok) {
        const j = await webFetchJsonErrorBody(res);
        throw new Error(j.message ?? j.cause ?? res.statusText);
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
      return {
        body: {
          id: request.id,
          message: lastUser ?? request.messages.at(-1),
          selectedModelSlug: isLegacyModelId ? undefined : modelId || undefined,
          ...request.body,
          workspaceSlug: workspaceSlug ? workspaceSlug : undefined,
        },
      };
    },
  });
}
