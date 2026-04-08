import { fetchAuthStatus, refreshAuthStatus } from "@/lib/auth/fetch-auth-status";
import { registerMainSiteStreamPort } from "@/lib/auth/main-site-stream-background";
import type { MainSitePostJsonProxyResult } from "@/lib/auth/main-site-post-json-proxy-message";
import { postMainSiteJsonWithFallback } from "@/lib/auth/post-main-site-json";
import { onMessage } from "@/lib/messaging/extension-messaging";
import {
  buildSidepanelSeedFromSelectionMessages,
  SIDEPANEL_SEED_FROM_SELECTION_KEY,
} from "@/lib/sidepanel-seed-from-selection";
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

  onMessage("openSidePanelWithSeedChat", async (message) => {
    const data = message.data;
    if (
      data === undefined ||
      typeof data.selectedText !== "string" ||
      typeof data.userQuery !== "string" ||
      typeof data.assistantAnswer !== "string"
    ) {
      return { ok: false, error: "参数无效" };
    }
    const tabId = message.sender.tab?.id;
    const windowId = message.sender.tab?.windowId;
    if (tabId === undefined && windowId === undefined) {
      return { ok: false, error: "无法确定标签页或窗口" };
    }
    const seed = buildSidepanelSeedFromSelectionMessages(
      data.selectedText,
      data.userQuery,
      data.assistantAnswer,
    );

    if (!browser.sidePanel?.open) {
      return { ok: false, error: "当前浏览器不支持侧栏 API" };
    }

    /**
     * `sidePanel.open()` 必须在用户手势链内尽快调用。
     * 若先 `await storage` 再 open，手势会失效，Chrome 会拒绝打开（常见于划词浮层经 messaging 进入 background）。
     * 顺序：先 open，再写入 session；侧栏通过 `storage.onChanged` 或下次读取拿到种子数据。
     */
    try {
      await browser.sidePanel.open(
        tabId !== undefined ? { tabId } : { windowId: windowId as number },
      );
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "无法打开侧栏";
      return { ok: false, error: msg };
    }

    try {
      await browser.storage.session.set({
        [SIDEPANEL_SEED_FROM_SELECTION_KEY]: seed,
      });
    } catch {
      return { ok: false, error: "无法写入会话数据" };
    }
    return { ok: true };
  });
});
