import { EXTENSION_AUTH_TAB_MESSAGE } from "@/lib/auth/auth-tab-message";
import {
  EXTENSION_CHAT_PROXY_MESSAGE_TYPE,
  type ExtensionChatProxyMessage,
  type ProxyChatPostResult,
} from "@/lib/auth/chat-proxy-message";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import { mainSiteAuthStorage } from "@/lib/storage/main-site-auth";

const matchPattern =
  typeof import.meta.env.WXT_WEB_MATCH_PATTERN === "string" &&
  import.meta.env.WXT_WEB_MATCH_PATTERN.length > 0
    ? import.meta.env.WXT_WEB_MATCH_PATTERN
    : "http://localhost:3000/*";
const MAIN_SITE_AUTH_CHANGED_EVENT = "WiseWrite:MainSiteAuthChanged";

async function fetchAuthPayloadFromPage(): Promise<AuthStatusPayload> {
  const res = await fetch(`${location.origin}/api/extension/auth-status`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    return { authenticated: false, user: null };
  }
  return (await res.json()) as AuthStatusPayload;
}

async function persistAuthPayload(payload: AuthStatusPayload): Promise<void> {
  await mainSiteAuthStorage.setValue({
    payload,
    syncedAt: Date.now(),
  });
}

async function syncAuthStatusToStorage(): Promise<void> {
  try {
    const payload = await fetchAuthPayloadFromPage();
    await persistAuthPayload(payload);
  } catch {
    // 网络或受限页面
  }
}

async function fetchChatPostInPage(body: string): Promise<ProxyChatPostResult> {
  const res = await fetch(`${location.origin}/api/chat`, {
    method: "POST",
    body,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  const buf = await res.arrayBuffer();
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    body: Array.from(new Uint8Array(buf)),
    headers: Object.fromEntries(res.headers.entries()),
  };
}

export default defineContentScript({
  matches: [matchPattern],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as ExtensionChatProxyMessage).type ===
          EXTENSION_CHAT_PROXY_MESSAGE_TYPE
      ) {
        const { body } = message as ExtensionChatProxyMessage;
        void (async () => {
          try {
            const result = await fetchChatPostInPage(body);
            sendResponse(result);
          } catch {
            sendResponse({
              ok: false,
              status: 0,
              statusText: "",
              body: [],
              headers: {},
            });
          }
        })();
        return true;
      }
      if (message !== EXTENSION_AUTH_TAB_MESSAGE) {
        return undefined;
      }
      void (async () => {
        try {
          const payload = await fetchAuthPayloadFromPage();
          await persistAuthPayload(payload);
          sendResponse(payload);
        } catch {
          sendResponse({ authenticated: false, user: null });
        }
      })();
      return true;
    });

    void syncAuthStatusToStorage();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void syncAuthStatusToStorage();
      }
    });
    window.addEventListener(MAIN_SITE_AUTH_CHANGED_EVENT, () => {
      void syncAuthStatusToStorage();
    });
  },
});
