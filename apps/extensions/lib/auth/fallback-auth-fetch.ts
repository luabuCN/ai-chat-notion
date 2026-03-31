import { getCookieHeaderForUrl } from "@/lib/auth/cookies";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import { WEB_ORIGIN } from "@/lib/web-config";

export async function fallbackFetchAuthStatus(): Promise<AuthStatusPayload> {
  const cookieHeader = await getCookieHeaderForUrl(WEB_ORIGIN);
  const headers = new Headers();
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }
  const res = await fetch(`${WEB_ORIGIN}/api/extension/auth-status`, {
    method: "GET",
    credentials: "omit",
    headers,
  });
  if (!res.ok) {
    return { authenticated: false, user: null };
  }
  return res.json() as Promise<AuthStatusPayload>;
}
