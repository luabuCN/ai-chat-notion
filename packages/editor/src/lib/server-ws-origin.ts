const SERVER_WS_PORT = 4000;
const LOCAL_ORIGIN_PATTERN =
  /^(ws|http)s?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

export function isLocalServerOrigin(origin: string | undefined): boolean {
  return !!origin && LOCAL_ORIGIN_PATTERN.test(origin);
}

function getBrowserWsBase(): string {
  const protocol = globalThis.location?.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${globalThis.location.hostname}:${SERVER_WS_PORT}`;
}

function getConfiguredWsBase(): string | undefined {
  const fromWsOrigin = process.env.NEXT_PUBLIC_WS_ORIGIN;
  if (fromWsOrigin && !isLocalServerOrigin(fromWsOrigin)) {
    return fromWsOrigin.replace(/\/$/, "");
  }

  const fromApiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN?.replace(/^http/, "ws");
  if (fromApiOrigin && !isLocalServerOrigin(fromApiOrigin)) {
    return fromApiOrigin.replace(/\/$/, "");
  }

  return undefined;
}

/** 后端 WebSocket 基础地址，如 ws://host:4000 */
export function resolveServerWsBase(): string {
  const configured = getConfiguredWsBase();
  if (configured) {
    return configured;
  }

  if (typeof globalThis.location !== "undefined") {
    return getBrowserWsBase();
  }

  return `ws://localhost:${SERVER_WS_PORT}`;
}

/** Hocuspocus 协同地址，如 ws://host:4000/collab */
export function resolveCollabWsUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
  if (configuredUrl && !isLocalServerOrigin(configuredUrl)) {
    return configuredUrl;
  }

  if (typeof globalThis.location !== "undefined") {
    return `${getBrowserWsBase()}/collab`;
  }

  try {
    const appUrl = new URL(
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080"
    );
    appUrl.protocol = appUrl.protocol.replace("http", "ws");
    appUrl.port = String(SERVER_WS_PORT);
    appUrl.pathname = "/collab";
    return appUrl.toString();
  } catch {
    return `ws://localhost:${SERVER_WS_PORT}/collab`;
  }
}
