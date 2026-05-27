export function getWebOrigin(): string {
  const raw = import.meta.env.WXT_WEB_ORIGIN as string | undefined;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export const WEB_ORIGIN = getWebOrigin();

export function getApiOrigin(): string {
  const raw = import.meta.env.WXT_API_ORIGIN as string | undefined;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return WEB_ORIGIN;
}

export const API_ORIGIN = getApiOrigin();
