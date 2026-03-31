import { defineExtensionMessaging } from "@webext-core/messaging";
import type { ExtensionProtocolMap } from "@/lib/messaging/protocol";

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ExtensionProtocolMap>();
