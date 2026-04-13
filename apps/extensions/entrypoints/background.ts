import { fetchAuthStatus, refreshAuthStatus } from "@/lib/auth/fetch-auth-status";
import { registerMainSiteStreamPort } from "@/lib/auth/main-site-stream-background";
import type { MainSitePostJsonProxyResult } from "@/lib/auth/main-site-post-json-proxy-message";
import { postMainSiteJsonWithFallback } from "@/lib/auth/post-main-site-json";
import { blobToDataUrl } from "@/lib/blob-to-data-url";
import { onMessage } from "@/lib/messaging/extension-messaging";
import { pageCaptureOverlayFn } from "@/lib/page-capture-overlay-fn";
import { dataUrlToFile } from "@/lib/data-url-to-file";
import {
  SIDEPANEL_PENDING_IMAGE_KEY,
} from "@/lib/sidepanel-pending-image";
import {
  buildSidepanelSeedFromSelectionMessages,
  SIDEPANEL_SEED_FROM_SELECTION_KEY,
} from "@/lib/sidepanel-seed-from-selection";
import { uploadFileToMainSite } from "@/lib/upload-main-site-file";
import { WEB_ORIGIN } from "@/lib/web-config";

type PageCapturePendingResult =
  | { ok: true; dataUrl: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

const pendingPageCaptures = new Map<
  string,
  {
    finish: (v: PageCapturePendingResult) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }
>();

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

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (typeof message !== "object" || message === null) {
      return;
    }
    if (!("type" in message)) {
      return;
    }
    if (message.type === "pageCaptureCropResult") {
      const m = message as { requestId?: unknown; dataUrl?: unknown };
      if (typeof m.requestId !== "string" || typeof m.dataUrl !== "string") {
        return;
      }
      const p = pendingPageCaptures.get(m.requestId);
      if (p) {
        clearTimeout(p.timeoutId);
        pendingPageCaptures.delete(m.requestId);
        p.finish({ ok: true, dataUrl: m.dataUrl });
      }
      sendResponse({});
      return true;
    }
    if (message.type === "pageCaptureCropCancel") {
      const m = message as { requestId?: unknown };
      if (typeof m.requestId !== "string") {
        return;
      }
      const p = pendingPageCaptures.get(m.requestId);
      if (p) {
        clearTimeout(p.timeoutId);
        pendingPageCaptures.delete(m.requestId);
        p.finish({ ok: false, cancelled: true });
      }
      sendResponse({});
      return true;
    }
    return undefined;
  });

  onMessage("pageCapture", async () => {
    const requestId = crypto.randomUUID();
    return await new Promise<PageCapturePendingResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        const p = pendingPageCaptures.get(requestId);
        if (p) {
          p.finish({ ok: false, error: "截取超时，请重试" });
        }
      }, 5 * 60 * 1000);

      pendingPageCaptures.set(requestId, {
        finish: (v) => {
          clearTimeout(timeoutId);
          pendingPageCaptures.delete(requestId);
          resolve(v);
        },
        timeoutId,
      });

      void (async () => {
        try {
          const win = await browser.windows.getCurrent();
          if (win.id === undefined) {
            throw new Error("无法获取当前窗口");
          }
          const tabs = await browser.tabs.query({
            active: true,
            windowId: win.id,
          });
          const tab = tabs[0];
          if (tab?.id === undefined) {
            throw new Error("无法获取当前标签页");
          }
          const tabId = tab.id;
          const dataUrl = await browser.tabs.captureVisibleTab(win.id, {
            format: "png",
          });
          await browser.scripting.executeScript({
            target: { tabId },
            func: pageCaptureOverlayFn,
            args: [dataUrl, requestId],
          });
        } catch (e) {
          const p = pendingPageCaptures.get(requestId);
          if (p) {
            p.finish({
              ok: false,
              error: e instanceof Error ? e.message : "无法截取当前页面",
            });
          }
        }
      })();
    });
  });

  onMessage("fetchImageUrlAsDataUrl", async (message) => {
    const payload = message.data;
    if (
      payload === undefined ||
      typeof payload !== "object" ||
      typeof payload.url !== "string"
    ) {
      return { error: "参数无效" };
    }
    let parsed: URL;
    try {
      parsed = new URL(payload.url);
    } catch {
      return { error: "无效的地址" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "仅支持 http(s) 地址" };
    }
    const referrer =
      typeof payload.referrer === "string" ? payload.referrer : undefined;
    const headers = new Headers();
    if (referrer !== undefined && referrer.length > 0) {
      headers.set("Referer", referrer);
    }
    try {
      const res = await fetch(payload.url, {
        credentials: "omit",
        headers,
      });
      if (!res.ok) {
        return { error: "无法加载图片" };
      }
      const blob = await res.blob();
      const type = blob.type;
      const looksLikeImage =
        type.startsWith("image/") ||
        type === "" ||
        type === "application/octet-stream";
      if (!looksLikeImage) {
        return { error: "不是有效的图片内容" };
      }
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl };
    } catch {
      return { error: "无法读取图片（网络错误）" };
    }
  });

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

  onMessage("openSidePanelWithImageDataUrl", async (message) => {
    const data = message.data;
    if (
      data === undefined ||
      typeof data.dataUrl !== "string" ||
      (data.mode !== "chat" && data.mode !== "extract")
    ) {
      return { ok: false, error: "参数无效" };
    }
    const tabId = message.sender.tab?.id;
    const windowId = message.sender.tab?.windowId;
    if (tabId === undefined && windowId === undefined) {
      return { ok: false, error: "无法确定标签页或窗口" };
    }
    if (!browser.sidePanel?.open) {
      return { ok: false, error: "当前浏览器不支持侧栏 API" };
    }
    try {
      await browser.sidePanel.open(
        tabId !== undefined ? { tabId } : { windowId: windowId as number },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "无法打开侧栏";
      return { ok: false, error: msg };
    }
    try {
      const file = await dataUrlToFile(
        data.dataUrl,
        `page-image-${Date.now()}.png`,
      );
      const uploaded = await uploadFileToMainSite(file);
      const mediaType =
        uploaded.contentType === "image/jpeg"
          ? ("image/jpeg" as const)
          : ("image/png" as const);
      await browser.storage.session.set({
        [SIDEPANEL_PENDING_IMAGE_KEY]: {
          attachment: {
            url: uploaded.url,
            name: uploaded.pathname,
            mediaType,
          },
          mode: data.mode,
        },
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "上传失败";
      try {
        await browser.storage.session.set({
          [SIDEPANEL_PENDING_IMAGE_KEY]: { error: errMsg },
        });
      } catch {
        // ignore
      }
    }
    return { ok: true };
  });
});
