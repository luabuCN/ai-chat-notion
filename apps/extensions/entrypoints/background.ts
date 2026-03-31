import { fetchAuthStatus, refreshAuthStatus } from "@/lib/auth/fetch-auth-status";
import { onMessage } from "@/lib/messaging/extension-messaging";

export default defineBackground(() => {
  if (browser.sidePanel?.setPanelBehavior) {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  onMessage("getAuthStatus", () => fetchAuthStatus());
  onMessage("refreshAuthStatus", () => refreshAuthStatus());
});
