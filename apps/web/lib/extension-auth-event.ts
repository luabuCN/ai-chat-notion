"use client";

export const MAIN_SITE_AUTH_CHANGED_EVENT = "WiseWrite:MainSiteAuthChanged";

export function dispatchMainSiteAuthChangedEvent(): void {
  window.dispatchEvent(new Event(MAIN_SITE_AUTH_CHANGED_EVENT));
}
