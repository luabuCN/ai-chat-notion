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
  "/api/notifications",
] as const;

export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/\/$/, "") || "";

export function isServerApiPath(input: string | URL): boolean {
  const value = typeof input === "string" ? input : input.href;
  let pathname: string;

  try {
    const base =
      globalThis.location?.origin ?? (API_ORIGIN || "http://localhost");
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

  if (!API_ORIGIN || !isServerApiPath(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return `${API_ORIGIN}${value}`;
  }

  const url = new URL(value);
  return `${API_ORIGIN}${url.pathname}${url.search}${url.hash}`;
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
