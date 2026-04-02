import { proxyMainSiteApiViaTab } from "@/lib/auth/proxy-main-site-api-via-tab";
import type { MainSiteApiProxyResult } from "@/lib/auth/main-site-api-proxy-message";
import { webFetchWithMainSiteCookies } from "@/lib/web-fetch";
import { WEB_ORIGIN } from "@/lib/web-config";

/**
 * 与 {@link createSidepanelChatTransport} 一致：用 `credentials: "include"` 让浏览器按目标源附带
 * Cookie（配合主站 CORS），避免手拼 `Cookie` 与真实会话不一致（历史/空间等 GET 曾因此 401）。
 * 非 2xx 时再回退到主站标签页内同源代理。
 */
export async function fetchMainSiteApiJson(
  path: string,
  method: "GET" | "DELETE",
): Promise<MainSiteApiProxyResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${WEB_ORIGIN}${normalizedPath}`;

  let direct: MainSiteApiProxyResult | null = null;
  try {
    const res = await webFetchWithMainSiteCookies(url, { method });
    let json: unknown = null;
    try {
      json = (await res.json()) as unknown;
    } catch {
      json = null;
    }
    direct = {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      json,
    };
  } catch {
    direct = null;
  }

  if (direct?.ok) {
    return direct;
  }

  const proxied = await proxyMainSiteApiViaTab(normalizedPath, method);
  if (proxied !== null) {
    return proxied;
  }

  if (direct !== null) {
    return direct;
  }

  return {
    ok: false,
    status: 0,
    statusText: "",
    json: null,
  };
}
