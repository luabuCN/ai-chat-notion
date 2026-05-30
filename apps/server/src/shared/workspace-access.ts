import { hasWorkspaceAccess } from "@repo/database";
import type { AuthSession } from "./auth.js";

/**
 * Verify if a user has access to a workspace (API-side).
 *
 * @param workspaceId Workspace ID to check
 * @param session Auth session of the current user
 */
export async function verifyWorkspaceAccess(
  workspaceId: string,
  session: AuthSession
): Promise<boolean> {
  if (!session?.user) {
    return false;
  }

  return await hasWorkspaceAccess({
    workspaceId,
    userId: session.user.id,
  });
}
