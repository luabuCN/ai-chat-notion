export const serverConfig = {
  httpPort: Number.parseInt(process.env.SERVER_HTTP_PORT || "4000", 10),
  collabPath: normalizeCollabPath(
    process.env.SERVER_COLLAB_PATH || "/collab"
  ),
  webOrigin:
    process.env.WEB_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  apiOrigin:
    process.env.API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    "http://localhost:4000",
  authSecret: process.env.AUTH_SECRET || "",
  apiAuthSecret: process.env.API_AUTH_SECRET || process.env.AUTH_SECRET || "",
  isProduction: process.env.NODE_ENV === "production",
};

function normalizeCollabPath(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

export function isLocalHttpEnvironment() {
  return (
    process.env.AUTH_TRUST_HOST === "true" ||
    serverConfig.webOrigin.startsWith("http://") ||
    serverConfig.webOrigin.startsWith("http://localhost") ||
    serverConfig.webOrigin.startsWith("http://127.0.0.1")
  );
}
