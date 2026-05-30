import { WEB_ORIGIN } from "@/lib/web-config";

let cachedToken: string | null = null;
let cachedExpiry = 0;
const EXPIRY_BUFFER_MS = 60_000;

interface TokenResponse {
  token: string;
  expiresIn: number;
}

async function fetchTokenDirect(): Promise<TokenResponse | null> {
  try {
    const res = await fetch(`${WEB_ORIGIN}/api/extension/api-token`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenResponse;
  } catch {
    return null;
  }
}

async function fetchTokenViaTab(): Promise<TokenResponse | null> {
  const origin = (() => {
    try {
      return new URL(WEB_ORIGIN).origin;
    } catch {
      return null;
    }
  })();
  if (!origin) return null;

  const tabs = await browser.tabs.query({ url: `${origin}/*` });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    try {
      const result = await browser.tabs.sendMessage(tab.id, {
        type: "WiseWrite:FETCH_API_TOKEN",
      });
      if (result && typeof result === "object" && "token" in result) {
        return result as TokenResponse;
      }
    } catch {
      // tab not ready
    }
  }
  return null;
}

/**
 * Get a valid API token, fetching a new one if needed.
 * Tries direct fetch first, then falls back to main-site tab proxy.
 */
export async function getApiToken(): Promise<string | null> {
  if (cachedToken && Date.now() < cachedExpiry) {
    return cachedToken;
  }

  const result = (await fetchTokenDirect()) ?? (await fetchTokenViaTab());
  if (!result) return null;

  cachedToken = result.token;
  cachedExpiry = Date.now() + result.expiresIn * 1000 - EXPIRY_BUFFER_MS;
  return cachedToken;
}

/** Force-refresh the token (e.g. after a 401). */
export async function refreshApiToken(): Promise<string | null> {
  cachedToken = null;
  cachedExpiry = 0;
  return getApiToken();
}
