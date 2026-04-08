import { EXTENSION_AUTH_TAB_MESSAGE } from "@/lib/auth/auth-tab-message";
import {
  EXTENSION_CHAT_PROXY_MESSAGE_TYPE,
  type ExtensionChatProxyMessage,
  type ProxyChatPostResult,
} from "@/lib/auth/chat-proxy-message";
import {
  EXTENSION_MAIN_SITE_API_PROXY_MESSAGE_TYPE,
  type ExtensionMainSiteApiProxyMessage,
  type MainSiteApiProxyResult,
} from "@/lib/auth/main-site-api-proxy-message";
import {
  EXTENSION_MAIN_SITE_POST_JSON_PROXY_MESSAGE_TYPE,
  type ExtensionMainSitePostJsonProxyMessage,
  type MainSitePostJsonProxyResult,
} from "@/lib/auth/main-site-post-json-proxy-message";
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

async function fetchMainSiteApiInPage(
  path: string,
  method: "GET" | "DELETE",
): Promise<MainSiteApiProxyResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${location.origin}${normalizedPath}`, {
    method,
    credentials: "same-origin",
  });
  let json: unknown = null;
  try {
    json = (await res.json()) as unknown;
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    json,
  };
}

async function fetchMainSitePostJsonInPage(
  path: string,
  body: string,
): Promise<MainSitePostJsonProxyResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${location.origin}${normalizedPath}`, {
    method: "POST",
    body,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  let json: unknown = null;
  try {
    json = (await res.json()) as unknown;
  } catch {
    json = null;
  }
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    json,
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
      if (
        typeof message === "object" &&
        message !== null &&
        (message as ExtensionMainSiteApiProxyMessage).type ===
          EXTENSION_MAIN_SITE_API_PROXY_MESSAGE_TYPE
      ) {
        const { path, method } = message as ExtensionMainSiteApiProxyMessage;
        void (async () => {
          try {
            const result = await fetchMainSiteApiInPage(path, method);
            sendResponse(result);
          } catch {
            sendResponse({
              ok: false,
              status: 0,
              statusText: "",
              json: null,
            });
          }
        })();
        return true;
      }
      if (
        typeof message === "object" &&
        message !== null &&
        (message as ExtensionMainSitePostJsonProxyMessage).type ===
          EXTENSION_MAIN_SITE_POST_JSON_PROXY_MESSAGE_TYPE
      ) {
        const { path, body } = message as ExtensionMainSitePostJsonProxyMessage;
        void (async () => {
          try {
            const result = await fetchMainSitePostJsonInPage(path, body);
            sendResponse(result);
          } catch {
            sendResponse({
              ok: false,
              status: 0,
              statusText: "",
              json: null,
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
