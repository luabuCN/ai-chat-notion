import { getApiToken, refreshApiToken } from "@/lib/auth/api-token";
import { API_ORIGIN } from "@/lib/web-config";

export type MainSiteApiResult = {
  ok: boolean;
  status: number;
  statusText: string;
  json: unknown;
};

/**
 * Fetch JSON from the server API using Bearer token auth.
 * Automatically refreshes the token on 401.
 */
export async function fetchMainSiteApiJson(
  path: string,
  method: "GET" | "DELETE",
): Promise<MainSiteApiResult> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_ORIGIN}${normalizedPath}`;

  const doFetch = async (token: string) =>
    fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    });

  let token = await getApiToken();
  if (!token) {
    return { ok: false, status: 401, statusText: "No API token", json: null };
  }

  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshApiToken();
    if (token) res = await doFetch(token);
  }

  let json: unknown = null;
  try {
    json = (await res.json()) as unknown;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, statusText: res.statusText, json };
}
