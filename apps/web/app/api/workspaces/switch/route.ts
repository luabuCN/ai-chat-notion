import { auth } from "@/app/(auth)/auth";
import {
  getWorkspaceBySlug,
  updateUserCurrentWorkspace,
  hasWorkspaceAccess,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";

// POST /api/workspaces/switch - 切换当前空间
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, slug } = await request.json();

    let targetWorkspaceId = workspaceId;

    // 如果提供了 slug 而不是 ID，则通过 slug 查找
    if (!targetWorkspaceId && slug) {
      const workspace = await getWorkspaceBySlug({ slug });
      if (!workspace) {
        return new ChatSDKError(
          "bad_request:api",
          "Workspace not found"
        ).toResponse();
      }
      targetWorkspaceId = workspace.id;
    }

    if (!targetWorkspaceId) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID or slug is required"
      ).toResponse();
    }

    // 检查用户是否有访问权限
    const hasAccess = await hasWorkspaceAccess({
      workspaceId: targetWorkspaceId,
      userId: session.user.id,
    });

    if (!hasAccess) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Access denied"
      ).toResponse();
    }

    await updateUserCurrentWorkspace({
      userId: session.user.id,
      workspaceId: targetWorkspaceId,
    });

    return NextResponse.json({ success: true, workspaceId: targetWorkspaceId });
  } catch (error) {
    console.error("Failed to switch workspace:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to switch workspace"
    ).toResponse();
  }
}
