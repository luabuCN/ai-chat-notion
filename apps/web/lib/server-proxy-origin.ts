/**
 * Server API proxy target for next.config rewrites (build-time) and Route Handlers (runtime).
 */
export function normalizeServerOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function resolveServerProxyOrigin(): string {
  const explicit = process.env.API_URL?.trim();
  if (explicit) {
    return normalizeServerOrigin(explicit);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }

  throw new Error(
    "Missing API_URL. Set it on the web project for production builds (e.g. https://your-server.vercel.app)."
  );
}
