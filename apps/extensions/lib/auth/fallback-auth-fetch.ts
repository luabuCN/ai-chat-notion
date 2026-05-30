import type { AuthStatusPayload } from "@/lib/messaging/protocol";

/**
 * Fallback auth check when no main site tab is available and no cache exists.
 * The service worker cannot reliably send cookies cross-origin, so we return
 * unauthenticated. The content script will sync the real state when the user
 * opens the main site.
 */
export async function fallbackFetchAuthStatus(): Promise<AuthStatusPayload> {
  return { authenticated: false, user: null };
}
