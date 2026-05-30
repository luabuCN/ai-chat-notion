import { sendMessage } from "@/lib/messaging/extension-messaging";
import type { AuthStatusPayload } from "@/lib/messaging/protocol";

export type { AuthStatusPayload } from "@/lib/messaging/protocol";

export async function getAuthStatus(): Promise<AuthStatusPayload> {
  return sendMessage("getAuthStatus");
}

export async function refreshAuthStatus(): Promise<AuthStatusPayload> {
  return sendMessage("refreshAuthStatus");
}

export async function openMainSiteLogin(): Promise<void> {
  await sendMessage("openMainSiteLogin");
}
