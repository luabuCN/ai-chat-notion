const SERVER_API_PREFIXES = [
  "/api/ai/completion",
  "/api/ai/openai",
  "/api/chat",
  "/api/collab/token",
  "/api/history",
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
  "/api/files",
  "/api/unsplash",
] as const;

type WindowWithApiOrigin = Window & { __API_ORIGIN__?: string };

/** 部署时优先读运行时 API_ORIGIN（layout 注入）；构建期回退 NEXT_PUBLIC_API_ORIGIN */
export function getApiOrigin(): string {
  if (typeof window !== "undefined") {
    const injected = (window as WindowWithApiOrigin).__API_ORIGIN__;
    if (injected) {
      return injected.replace(/\/$/, "");
    }
  }

  const fromEnv =
    process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_ORIGIN || "";
  return fromEnv.replace(/\/$/, "");
}

export function isServerApiPath(input: string | URL): boolean {
  const value = typeof input === "string" ? input : input.href;
  let pathname: string;

  try {
    const base =
      globalThis.location?.origin ?? (getApiOrigin() || "http://localhost");
    pathname = new URL(value, base).pathname;
  } catch {
    pathname = value.split("?")[0]?.split("#")[0] ?? value;
  }

  return SERVER_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function apiUrl(path: string | URL): string {
  const value = typeof path === "string" ? path : path.href;

  const origin = getApiOrigin();
  if (!origin || !isServerApiPath(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${origin}${value}`;
  }

  const url = new URL(value);
  return `${origin}${url.pathname}${url.search}${url.hash}`;
}

export async function apiFetch(
  input: string | URL,
  init?: RequestInit
): Promise<Response> {
  const target = apiUrl(input);
  const shouldIncludeCredentials = isServerApiPath(input);
  return fetch(target, {
    ...init,
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
      message = body.message ?? body.error ?? body.cause ?? message;
    } catch {
      // keep status text
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
