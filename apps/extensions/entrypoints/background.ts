import { fetchAuthStatus, refreshAuthStatus } from "@/lib/auth/fetch-auth-status";
import { registerMainSiteStreamPort } from "@/lib/auth/main-site-stream-background";
import type { MainSitePostJsonProxyResult } from "@/lib/auth/main-site-post-json-proxy-message";
import { postMainSiteJsonWithFallback } from "@/lib/auth/post-main-site-json";
import { onMessage } from "@/lib/messaging/extension-messaging";
import { WEB_ORIGIN } from "@/lib/web-config";

function postMainSiteJsonNetworkError(): MainSitePostJsonProxyResult {
  return {
    ok: false,
    status: 0,
    statusText: "",
    json: null,
  };
}

export default defineBackground(() => {
  if (browser.sidePanel?.setPanelBehavior) {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  registerMainSiteStreamPort();

  onMessage("getAuthStatus", () => fetchAuthStatus());
  onMessage("refreshAuthStatus", () => refreshAuthStatus());
  onMessage("openMainSiteLogin", () => {
    void browser.tabs.create({ url: `${WEB_ORIGIN}/login` });
  });
  /**
   * 必须 async 且避免同步抛错：否则 webext-core 无法把回复传回 content script，会报 Error: No response。
   */
  onMessage("postMainSiteJson", async (message) => {
    const data = message.data;
    if (
      data === undefined ||
      typeof data.path !== "string" ||
      typeof data.body !== "string"
    ) {
      return postMainSiteJsonNetworkError();
    }
    try {
      return await postMainSiteJsonWithFallback(data.path, data.body);
    } catch {
      return postMainSiteJsonNetworkError();
    }
  });
});
