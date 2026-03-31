export function getWebOrigin(): string {
  const raw = import.meta.env.WXT_WEB_ORIGIN as string | undefined;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export const WEB_ORIGIN = getWebOrigin();
