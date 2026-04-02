import {
  EXTENSION_MAIN_SITE_API_PROXY_MESSAGE_TYPE,
  type ExtensionMainSiteApiProxyMessage,
  type MainSiteApiProxyResult,
} from "@/lib/auth/main-site-api-proxy-message";
import { WEB_ORIGIN } from "@/lib/web-config";

export async function proxyMainSiteApiViaTab(
  path: string,
  method: "GET" | "DELETE",
): Promise<MainSiteApiProxyResult | null> {
  let origin: string;
  try {
    origin = new URL(WEB_ORIGIN).origin;
  } catch {
    return null;
  }

  const tabs = await browser.tabs.query({ url: `${origin}/*` });
  const payload: ExtensionMainSiteApiProxyMessage = {
    type: EXTENSION_MAIN_SITE_API_PROXY_MESSAGE_TYPE,
    path,
    method,
  };

  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }
    try {
      const result = (await browser.tabs.sendMessage(
        tab.id,
        payload,
      )) as MainSiteApiProxyResult | undefined;
      if (result && typeof result.ok === "boolean") {
        return result;
      }
    } catch {
      // 该标签无注入、或尚未就绪
    }
  }
  return null;
}
