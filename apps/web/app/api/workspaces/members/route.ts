import { getAuthFromRequest } from "@/lib/api-auth";
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
  const { user } = getAuthFromRequest(request);

  if (!user) {
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
      userId: user.id,
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
  const { user } = getAuthFromRequest(request);

  if (!user) {
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

    if (workspace.ownerId !== user.id) {
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

// PATCH /api/workspaces/members - 更新成员角色或权限
export async function PATCH(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, userId, role, permission } = await request.json();

    if (!workspaceId || !userId) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    if (!role && !permission) {
      return new ChatSDKError(
        "bad_request:api",
        "Role or permission is required"
      ).toResponse();
    }

    const workspace = await getWorkspaceById({ id: workspaceId });
    if (!workspace) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace not found"
      ).toResponse();
    }

    const isOwner = workspace.ownerId === user.id;

    // 获取当前用户在此空间的角色
    const currentUserMembers = await getWorkspaceMembers({ workspaceId });
    const currentUserMember = currentUserMembers.find(
      (m) => m.userId === user.id
    );
    const isAdmin = currentUserMember?.role === "admin";

    // 获取被操作用户的角色
    const targetMember = currentUserMembers.find((m) => m.userId === userId);
    if (!targetMember) {
      return new ChatSDKError(
        "bad_request:api",
        "Member not found"
      ).toResponse();
    }

    // 权限检查
    // 1. 所有者可以操作任何人（除了修改自己的角色为非owner）
    // 2. 管理员只能操作普通成员
    if (!isOwner) {
      if (!isAdmin) {
        return new ChatSDKError(
          "unauthorized:chat",
          "Only owner or admin can update members"
        ).toResponse();
      }
      // 管理员不能操作其他管理员或所有者
      if (
        targetMember.role === "admin" ||
        targetMember.role === "owner" ||
        targetMember.userId === workspace.ownerId
      ) {
        return new ChatSDKError(
          "unauthorized:chat",
          "Admin can only update regular members"
        ).toResponse();
      }
    }

    // 不允许修改所有者的角色
    if (userId === workspace.ownerId && role && role !== "owner") {
      return new ChatSDKError(
        "bad_request:api",
        "Cannot change owner's role"
      ).toResponse();
    }

    const member = await updateWorkspaceMemberRole({
      workspaceId,
      userId,
      role,
      permission,
    });
    return NextResponse.json(member);
  } catch (error) {
    console.error("Failed to update member:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to update member"
    ).toResponse();
  }
}

// DELETE /api/workspaces/members?workspaceId=xxx&userId=xxx - 移除成员
export async function DELETE(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
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
    if (workspace.ownerId !== user.id && userId !== user.id) {
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
