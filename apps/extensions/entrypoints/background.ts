import { fetchAuthStatus, refreshAuthStatus } from "@/lib/auth/fetch-auth-status";
import { onMessage } from "@/lib/messaging/extension-messaging";
import { WEB_ORIGIN } from "@/lib/web-config";

export default defineBackground(() => {
  if (browser.sidePanel?.setPanelBehavior) {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  onMessage("getAuthStatus", () => fetchAuthStatus());
  onMessage("refreshAuthStatus", () => refreshAuthStatus());
  onMessage("openMainSiteLogin", () => {
    void browser.tabs.create({ url: `${WEB_ORIGIN}/login` });
  });
});
