import { EXTENSION_AUTH_TAB_MESSAGE } from "@/lib/auth/auth-tab-message";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import { WEB_ORIGIN } from "@/lib/web-config";

/**
 * 若存在主站标签页，由该页 content script 发起同源 fetch（SW 无法可靠携带 Cookie）。
 */
export async function fetchAuthStatusViaMainSiteTab(): Promise<AuthStatusPayload | null> {
  let origin: string;
  try {
    origin = new URL(WEB_ORIGIN).origin;
  } catch {
    return null;
  }
  const tabs = await browser.tabs.query({ url: `${origin}/*` });
  for (const tab of tabs) {
    if (tab.id === undefined) {
      continue;
    }
    try {
      const payload = await browser.tabs.sendMessage(
        tab.id,
        EXTENSION_AUTH_TAB_MESSAGE,
      );
      if (
        payload &&
        typeof payload === "object" &&
        "authenticated" in payload
      ) {
        return payload as AuthStatusPayload;
      }
    } catch {
      // 该标签无注入、或尚未就绪
    }
  }
  return null;
}
