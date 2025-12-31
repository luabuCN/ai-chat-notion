import { auth } from "@/app/(auth)/auth";
import {
  getWorkspaceById,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  hasWorkspaceAccess,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";

// GET /api/workspaces/members?workspaceId=xxx - 获取空间成员
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID is required"
      ).toResponse();
    }

    // 检查访问权限
    const hasAccess = await hasWorkspaceAccess({
      workspaceId,
      userId: session.user.id,
    });

    if (!hasAccess) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Access denied"
      ).toResponse();
    }

    const members = await getWorkspaceMembers({ workspaceId });
    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to get workspace members:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get members"
    ).toResponse();
  }
}

// POST /api/workspaces/members - 添加成员
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, userId, role = "member" } = await request.json();

    if (!workspaceId || !userId) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    // 检查当前用户是否是管理员或所有者
    const workspace = await getWorkspaceById({ id: workspaceId });
    if (!workspace) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace not found"
      ).toResponse();
    }

    if (workspace.ownerId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Only owner can add members"
      ).toResponse();
    }

    const member = await addWorkspaceMember({ workspaceId, userId, role });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Failed to add member:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to add member"
    ).toResponse();
  }
}

// PATCH /api/workspaces/members - 更新成员角色
export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, userId, role } = await request.json();

    if (!workspaceId || !userId || !role) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID, User ID, and role are required"
      ).toResponse();
    }

    const workspace = await getWorkspaceById({ id: workspaceId });
    if (!workspace || workspace.ownerId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Only owner can update roles"
      ).toResponse();
    }

    const member = await updateWorkspaceMemberRole({
      workspaceId,
      userId,
      role,
    });
    return NextResponse.json(member);
  } catch (error) {
    console.error("Failed to update member role:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update role"
    ).toResponse();
  }
}

// DELETE /api/workspaces/members?workspaceId=xxx&userId=xxx - 移除成员
export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    const userId = searchParams.get("userId");

    if (!workspaceId || !userId) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    const workspace = await getWorkspaceById({ id: workspaceId });
    if (!workspace) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace not found"
      ).toResponse();
    }

    // 只有所有者可以移除成员，或者成员可以移除自己
    if (workspace.ownerId !== session.user.id && userId !== session.user.id) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Permission denied"
      ).toResponse();
    }

    // 不能移除所有者
    if (userId === workspace.ownerId) {
      return new ChatSDKError(
        "bad_request:api",
        "Cannot remove workspace owner"
      ).toResponse();
    }

    await removeWorkspaceMember({ workspaceId, userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to remove member"
    ).toResponse();
  }
}
