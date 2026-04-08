import type { MainSitePostJsonProxyResult } from "@/lib/auth/main-site-post-json-proxy-message";
import { proxyMainSitePostJsonViaTab } from "@/lib/auth/proxy-main-site-post-json-via-tab";
import { WEB_ORIGIN } from "@/lib/web-config";

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

async function fetchMainSitePostJsonDirect(
  path: string,
  body: string,
): Promise<MainSitePostJsonProxyResult> {
  const base = WEB_ORIGIN.replace(/\/$/, "");
  const url = `${base}${normalizePath(path)}`;
  const res = await fetch(url, {
    method: "POST",
    body,
    credentials: "include",
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

/**
 * 仅在 **background** 中调用：先同源直连（与侧栏 `webFetchWithMainSiteCookies` 一致，不依赖主站标签），
 * 抛错或 401 时再回退到主站标签页内代理。
 */
export async function postMainSiteJsonWithFallback(
  path: string,
  body: string,
): Promise<MainSitePostJsonProxyResult> {
  let direct: MainSitePostJsonProxyResult;
  try {
    direct = await fetchMainSitePostJsonDirect(path, body);
  } catch {
    const proxied = await proxyMainSitePostJsonViaTab(path, body);
    if (proxied !== null) {
      return proxied;
    }
    return {
      ok: false,
      status: 0,
      statusText: "",
      json: null,
    };
  }
  if (direct.status === 401) {
    const proxied = await proxyMainSitePostJsonViaTab(path, body);
    if (proxied !== null) {
      return proxied;
    }
  }
  return direct;
}
