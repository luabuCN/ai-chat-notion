import {
  EXTENSION_MAIN_SITE_POST_JSON_PROXY_MESSAGE_TYPE,
  type ExtensionMainSitePostJsonProxyMessage,
  type MainSitePostJsonProxyResult,
} from "@/lib/auth/main-site-post-json-proxy-message";
import { WEB_ORIGIN } from "@/lib/web-config";

export type { MainSitePostJsonProxyResult } from "@/lib/auth/main-site-post-json-proxy-message";

/**
 * 由主站标签页 content script 发起同源 POST，会话 Cookie 与页面一致。
 * 与 {@link proxyChatPostViaMainSiteTab} 同思路，路径可配置。
 */
export async function proxyMainSitePostJsonViaTab(
  path: string,
  body: string,
): Promise<MainSitePostJsonProxyResult | null> {
  let origin: string;
  try {
    origin = new URL(WEB_ORIGIN).origin;
  } catch {
    return null;
  }
  const tabs = await browser.tabs.query({ url: `${origin}/*` });
  const payload: ExtensionMainSitePostJsonProxyMessage = {
    type: EXTENSION_MAIN_SITE_POST_JSON_PROXY_MESSAGE_TYPE,
    path,
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
      )) as MainSitePostJsonProxyResult | undefined;
      if (
        result &&
        typeof result.ok === "boolean" &&
        "json" in result
      ) {
        return result;
      }
    } catch {
      // 该标签无注入、或尚未就绪
    }
  }
  return null;
}
