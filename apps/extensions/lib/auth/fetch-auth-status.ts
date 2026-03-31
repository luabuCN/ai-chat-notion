import { fallbackFetchAuthStatus } from "@/lib/auth/fallback-auth-fetch";
import { fetchAuthStatusViaMainSiteTab } from "@/lib/auth/fetch-auth-from-tab";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import {
  type MainSiteAuthRecord,
  mainSiteAuthStorage,
} from "@/lib/storage/main-site-auth";

/** 无主站标签且 SW 兜底不可靠时，在此时间内保留「已登录」缓存，避免被误覆盖为未登录 */
const SESSION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

function shouldKeepCachedSessionWhenFallbackSaysLoggedOut(
  previous: MainSiteAuthRecord | null,
  fallbackPayload: AuthStatusPayload,
): boolean {
  if (fallbackPayload.authenticated) {
    return false;
  }
  if (!previous?.payload.authenticated) {
    return false;
  }
  if (Date.now() - previous.syncedAt > SESSION_CACHE_TTL_MS) {
    return false;
  }
  return true;
}

/**
 * 1) 若有主站标签页：由页面同源 fetch（可靠）
 * 2) 否则读扩展缓存
 * 3) 最后尝试 Cookie 头请求（SW 中可能被浏览器丢弃 Cookie 头，仅作兜底）
 */
export async function fetchAuthStatus(): Promise<AuthStatusPayload> {
  const fromTab = await fetchAuthStatusViaMainSiteTab();
  if (fromTab !== null) {
    await mainSiteAuthStorage.setValue({
      payload: fromTab,
      syncedAt: Date.now(),
    });
    return fromTab;
  }
  const cached = await mainSiteAuthStorage.getValue();
  if (cached !== null) {
    return cached.payload;
  }
  const payload = await fallbackFetchAuthStatus();
  await mainSiteAuthStorage.setValue({
    payload,
    syncedAt: Date.now(),
  });
  return payload;
}

/** 优先主站标签页；无主站时兜底不可靠，勿用「未登录」覆盖仍在 TTL 内的已登录缓存 */
export async function refreshAuthStatus(): Promise<AuthStatusPayload> {
  const fromTab = await fetchAuthStatusViaMainSiteTab();
  if (fromTab !== null) {
    await mainSiteAuthStorage.setValue({
      payload: fromTab,
      syncedAt: Date.now(),
    });
    return fromTab;
  }
  const previous = await mainSiteAuthStorage.getValue();
  const payload = await fallbackFetchAuthStatus();
  if (
    previous !== null &&
    shouldKeepCachedSessionWhenFallbackSaysLoggedOut(previous, payload)
  ) {
    return previous.payload;
  }
  await mainSiteAuthStorage.setValue({
    payload,
    syncedAt: Date.now(),
  });
  return payload;
}
