import { sendMessage } from "@/lib/messaging/extension-messaging";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import { WEB_ORIGIN } from "@/lib/web-config";

export type { AuthStatusPayload } from "@/lib/messaging/protocol";

export async function getAuthStatus(): Promise<AuthStatusPayload> {
  return sendMessage("getAuthStatus");
}

export async function refreshAuthStatus(): Promise<AuthStatusPayload> {
  return sendMessage("refreshAuthStatus");
}

export async function openMainSiteLogin(): Promise<void> {
  await browser.tabs.create({ url: `${WEB_ORIGIN}/login` });
}
