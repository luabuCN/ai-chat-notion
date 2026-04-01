import {
  EXTENSION_CHAT_PROXY_MESSAGE_TYPE,
  type ExtensionChatProxyMessage,
  type ProxyChatPostResult,
} from "@/lib/auth/chat-proxy-message";
import { WEB_ORIGIN } from "@/lib/web-config";

export type { ProxyChatPostResult } from "@/lib/auth/chat-proxy-message";

/**
 * 与 {@link fetchAuthStatusViaMainSiteTab} 相同思路：由主站页面发起同源 fetch，会话 Cookie 可靠。
 * 侧栏用 Cookie 头直连常导致 auth() 与扩展「已登录」展示不一致。
 */
export async function proxyChatPostViaMainSiteTab(
  body: string,
): Promise<ProxyChatPostResult | null> {
  let origin: string;
  try {
    origin = new URL(WEB_ORIGIN).origin;
  } catch {
    return null;
  }
  const tabs = await browser.tabs.query({ url: `${origin}/*` });
  const payload: ExtensionChatProxyMessage = {
    type: EXTENSION_CHAT_PROXY_MESSAGE_TYPE,
    body,
  };
  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }
    try {
      const result = (await browser.tabs.sendMessage(
        tab.id,
        payload,
      )) as ProxyChatPostResult | undefined;
      if (result && typeof result.ok === "boolean" && Array.isArray(result.body)) {
        return result;
      }
    } catch {
      // 该标签无注入、或尚未就绪
    }
  }
  return null;
}
