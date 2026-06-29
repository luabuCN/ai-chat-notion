/**
 * Server API proxy target for next.config rewrites (build-time) and Route Handlers (runtime).
 *
 * Priority: API_PROXY_URL → API_ORIGIN → localhost (dev) → Docker internal (DOCKER_BUILD only).
 */
export function normalizeServerOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

export function resolveServerProxyOrigin(): string {
  const explicit =
    process.env.API_PROXY_URL?.trim() || process.env.API_ORIGIN?.trim();
  if (explicit) {
    return normalizeServerOrigin(explicit);
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:4000";
  }

  // Docker Compose: web/server share a network; compose injects API_PROXY_URL by default.
  if (process.env.DOCKER_BUILD === "1") {
    return "http://server:4000";
  }

  throw new Error(
    "Missing API_PROXY_URL or API_ORIGIN. Set one on the web project for production builds (e.g. Vercel split deploy: API_ORIGIN=https://your-server.vercel.app)."
  );
}
