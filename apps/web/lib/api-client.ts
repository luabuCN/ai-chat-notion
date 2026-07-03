const SERVER_API_PREFIXES = [
  "/api/ai/completion",
  "/api/ai/openai",
  "/api/chat",
  "/api/collab/token",
  "/api/history",
  "/api/token-usage",
  "/api/models",
  "/api/workspaces",
  "/api/editor-documents",
  "/api/document",
  "/api/documents",
  "/api/vote",
  "/api/suggestions",
  "/api/invite",
  "/api/users",
  "/api/image",
  "/api/pdf",
  "/api/document-import",
  "/api/web-scrape",
  "/api/jobs",
  "/api/files",
  "/api/unsplash",
  "/api/notifications",
] as const;

/** 流式接口必须走同源 Route Handler 代理，不能重定向到后端地址（会绕过防缓冲代理） */
const STREAMING_API_PREFIXES = [
  "/api/chat",
  "/api/ai/openai",
  "/api/ai/completion",
  "/api/pdf",
  "/api/document-import",
] as const;

export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * 本地 dev + 远程 API：Next rewrites 由 Node 发起，常因网络无法访问 Vercel 而 ETIMEDOUT。
 * 浏览器直连远程 API，并通过同源 /api/extension/api-token 换取 Bearer 鉴权。
 */
export function isRemoteBackendDevMode(): boolean {
  if (typeof globalThis.location === "undefined" || !API_ORIGIN) {
    return false;
  }

  if (!isLocalHostname(globalThis.location.hostname)) {
    return false;
  }

  try {
    return !isLocalHostname(new URL(API_ORIGIN).hostname);
  } catch {
    return false;
  }
}

let cachedBearerToken: { token: string; expiresAt: number } | null = null;

async function getApiBearerToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedBearerToken && cachedBearerToken.expiresAt > now + 30_000) {
    return cachedBearerToken.token;
  }

  const response = await fetch("/api/extension/api-token", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    cachedBearerToken = null;
    return null;
  }

  const data = (await response.json()) as {
    token?: string;
    expiresIn?: number;
  };
  if (!data.token) {
    return null;
  }

  cachedBearerToken = {
    token: data.token,
    expiresAt: now + (data.expiresIn ?? 900) * 1000,
  };
  return data.token;
}

function resolvePathname(input: string | URL): string {
  const value = typeof input === "string" ? input : input.href;

  try {
    const base =
      globalThis.location?.origin ?? (API_ORIGIN || "http://localhost");
    return new URL(value, base).pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0] ?? value;
  }
}

function resolveServerApiPath(input: string | URL): string {
  const value = typeof input === "string" ? input : input.href;
  if (value.startsWith("/")) {
    return value;
  }
  return resolvePathname(value);
}

export function isServerApiPath(input: string | URL): boolean {
  const pathname = resolvePathname(input);

  return SERVER_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isStreamingApiPath(input: string | URL): boolean {
  const pathname = resolvePathname(input);

  return STREAMING_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function apiUrl(path: string | URL): string {
  const value = typeof path === "string" ? path : path.href;
  const pathname = resolveServerApiPath(path);

  if (isStreamingApiPath(value)) {
    if (isRemoteBackendDevMode()) {
      return `${API_ORIGIN}${pathname}`;
    }
    return pathname;
  }

  if (!isServerApiPath(value)) {
    return value;
  }

  if (isRemoteBackendDevMode()) {
    return `${API_ORIGIN}${pathname}`;
  }

  // 浏览器端走同源，经 Next rewrites 代理并携带 session cookie
  if (typeof globalThis.location !== "undefined") {
    return pathname;
  }

  // SSR / Route Handler：直连后端
  if (!API_ORIGIN) {
    return pathname;
  }

  return `${API_ORIGIN}${pathname}`;
}

const INTERNAL_API_CAUSE_PATTERN = /^[a-z][a-z0-9_]*$/;

export function getApiErrorMessage(
  payload: { message?: string; cause?: string },
  fallback = "操作失败"
): string {
  const cause = payload.cause?.trim();
  if (cause && !INTERNAL_API_CAUSE_PATTERN.test(cause)) {
    return cause;
  }

  const message = payload.message?.trim();
  if (message) {
    return message;
  }

  return fallback;
}

export async function apiFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const target = apiUrl(input);
  const headers = new Headers(init?.headers);
  const remoteDev = isRemoteBackendDevMode() && isServerApiPath(input);

  if (remoteDev) {
    const token = await getApiBearerToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const shouldIncludeCredentials = isServerApiPath(input) && !remoteDev;

  return fetch(target, {
    ...init,
    headers,
    credentials: shouldIncludeCredentials ? "include" : init?.credentials,
  });
}

export async function apiJson<T>(
  input: string | URL,
  init?: RequestInit
): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = await response.json();
      message = getApiErrorMessage(body, message);
    } catch {
      // keep status text
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
