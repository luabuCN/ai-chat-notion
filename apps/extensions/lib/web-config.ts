export function getWebOrigin(): string {
  const raw = import.meta.env.WXT_WEB_ORIGIN as string | undefined;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export const WEB_ORIGIN = getWebOrigin();

const DEFAULT_API_ORIGIN = "http://localhost:4000";

/** 业务 API 基址（直连 server）。auth / api-token 仍走 {@link WEB_ORIGIN}。 */
export function getApiOrigin(): string {
  const raw = import.meta.env.WXT_API_ORIGIN as string | undefined;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return DEFAULT_API_ORIGIN;
}

export const API_ORIGIN = getApiOrigin();
