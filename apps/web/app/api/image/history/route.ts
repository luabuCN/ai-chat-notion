import type { NextRequest } from "next/server";
import {
  getImageGenerationsForUser,
  getImageGenerationsForWorkspace,
  getWorkspaceBySlug,
  hasWorkspaceAccess,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { getAuthFromRequest } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const workspaceSlug = request.nextUrl.searchParams.get("workspace");
  const scope = request.nextUrl.searchParams.get("scope") || "workspace";
  const limit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") || "24",
    10
  );

  try {
    let workspaceId: string | null | undefined;

    if (workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });

      if (!workspace) {
        return Response.json({ items: [] });
      }

      const hasAccess = await hasWorkspaceAccess({
        workspaceId: workspace.id,
        userId: user.id,
      });

      if (!hasAccess) {
        return new ChatSDKError(
          "unauthorized:chat",
          "Access denied"
        ).toResponse();
      }

      workspaceId = workspace.id;

      if (scope !== "user") {
        const items = await getImageGenerationsForWorkspace({
          workspaceId: workspace.id,
          limit,
        });

        return Response.json({ items, scope: "workspace" });
      }
    }

    const items = await getImageGenerationsForUser({
      userId: user.id,
      workspaceId,
      limit,
    });

    return Response.json({ items, scope: "user" });
  } catch (error) {
    console.error("Failed to fetch image history:", error);

    return Response.json({
      items: [],
      scope: workspaceSlug && scope !== "user" ? "workspace" : "user",
    });
  }
}
