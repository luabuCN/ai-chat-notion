import type { AuthStatusPayload } from "@/lib/messaging/protocol";
import { storage } from "#imports";

export type MainSiteAuthRecord = {
  payload: AuthStatusPayload;
  syncedAt: number;
};

export const mainSiteAuthStorage = storage.defineItem<MainSiteAuthRecord | null>(
  "local:mainSiteAuth",
  { defaultValue: null },
);
