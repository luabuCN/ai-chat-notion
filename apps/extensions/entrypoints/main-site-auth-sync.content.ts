import { EXTENSION_AUTH_TAB_MESSAGE } from "@/lib/auth/auth-tab-message";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import { mainSiteAuthStorage } from "@/lib/storage/main-site-auth";

const matchPattern =
  typeof import.meta.env.WXT_WEB_MATCH_PATTERN === "string" &&
  import.meta.env.WXT_WEB_MATCH_PATTERN.length > 0
    ? import.meta.env.WXT_WEB_MATCH_PATTERN
    : "http://localhost:3000/*";
const MAIN_SITE_AUTH_CHANGED_EVENT = "WiseWrite:MainSiteAuthChanged";
const AUTH_FETCH_DEBOUNCE_MS = 1_000;

let lastFetchAt = 0;
let lastFetchPayload: AuthStatusPayload | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | undefined;

async function fetchAuthPayloadFromPage(): Promise<AuthStatusPayload> {
  if (
    lastFetchPayload !== null &&
    Date.now() - lastFetchAt < AUTH_FETCH_DEBOUNCE_MS
  ) {
    return lastFetchPayload;
  }

  const res = await fetch(`${location.origin}/api/extension/auth-status`, {
    credentials: "same-origin",
  });
  if (!res.ok) {
    lastFetchPayload = { authenticated: false, user: null };
    lastFetchAt = Date.now();
    return lastFetchPayload;
  }
  lastFetchPayload = (await res.json()) as AuthStatusPayload;
  lastFetchAt = Date.now();
  return lastFetchPayload;
}

async function persistAuthPayload(payload: AuthStatusPayload): Promise<void> {
  await mainSiteAuthStorage.setValue({
    payload,
    syncedAt: Date.now(),
  });
}

function scheduleSyncAuthStatusToStorage(): void {
  if (syncDebounceTimer !== undefined) {
    clearTimeout(syncDebounceTimer);
  }
  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = undefined;
    void syncAuthStatusToStorage();
  }, AUTH_FETCH_DEBOUNCE_MS);
}

async function syncAuthStatusToStorage(): Promise<void> {
  try {
    const payload = await fetchAuthPayloadFromPage();
    await persistAuthPayload(payload);
  } catch {
    // 网络或受限页面
  }
}

async function fetchApiTokenFromPage(): Promise<{
  token: string;
  expiresIn: number;
} | null> {
  try {
    const res = await fetch(`${location.origin}/api/extension/api-token`, {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    return (await res.json()) as { token: string; expiresIn: number };
  } catch {
    return null;
  }
}

export default defineContentScript({
  matches: [matchPattern],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "WiseWrite:FETCH_API_TOKEN"
      ) {
        void (async () => {
          sendResponse(await fetchApiTokenFromPage());
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
        scheduleSyncAuthStatusToStorage();
      }
    });
    window.addEventListener(MAIN_SITE_AUTH_CHANGED_EVENT, () => {
      scheduleSyncAuthStatusToStorage();
    });
  },
});
