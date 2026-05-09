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
import {
  assertWorkspaceCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "@/lib/permission-assert";

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
    const { workspaceId, userId, role = "member", permission } =
      await request.json();

    if (!workspaceId || !userId) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    // 校验当前用户是否有管理权限（owner/admin）
    try {
      await assertWorkspaceCanManage(workspaceId, user.id);
    } catch (error) {
      if (isPermissionChangedError(error)) {
        return permissionChangedResponse();
      }
      throw error;
    }

    const member = await addWorkspaceMember({
      workspaceId,
      userId,
      role,
      permission: role === "admin" ? "edit" : permission,
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
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

    // 校验当前用户是否有管理权限（owner/admin），权限不足直接抛出
    const callerInfo = await assertWorkspaceCanManage(workspaceId, user.id);
    const workspace = await getWorkspaceById({ id: workspaceId });

    // 获取被操作用户的角色
    const members = await getWorkspaceMembers({ workspaceId });
    const targetMember = members.find((m) => m.userId === userId);
    if (!targetMember) {
      return new ChatSDKError(
        "bad_request:api",
        "Member not found"
      ).toResponse();
    }

    // 管理员不能操作其他管理员或所有者
    if (
      !callerInfo.isOwner &&
      (targetMember.role === "admin" ||
        targetMember.role === "owner" ||
        targetMember.userId === workspace?.ownerId)
    ) {
      return new ChatSDKError(
        "unauthorized:chat",
        "Admin can only update regular members"
      ).toResponse();
    }

    // 不允许修改所有者的角色或权限
    if (userId === workspace?.ownerId) {
      return new ChatSDKError(
        "bad_request:api",
        "Cannot change workspace owner"
      ).toResponse();
    }

    const nextRole = role ?? targetMember.role;
    if (nextRole === "admin" && permission === "view") {
      return new ChatSDKError(
        "bad_request:api",
        "Admin must have edit permission"
      ).toResponse();
    }

    const member = await updateWorkspaceMemberRole({
      workspaceId,
      userId,
      role,
      permission: nextRole === "admin" ? "edit" : permission,
    });
    return NextResponse.json(member);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
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

    // 不能移除所有者
    const workspace = await getWorkspaceById({ id: workspaceId });
    if (!workspace) {
      return new ChatSDKError(
        "bad_request:api",
        "Workspace not found"
      ).toResponse();
    }

    if (userId === workspace.ownerId) {
      return new ChatSDKError(
        "bad_request:api",
        "Cannot remove workspace owner"
      ).toResponse();
    }

    // 成员自己退出，不需要管理权限
    if (userId === user.id) {
      await removeWorkspaceMember({ workspaceId, userId });
      return NextResponse.json({ success: true });
    }

    // 管理员移除其他成员，需要校验管理权限
    try {
      await assertWorkspaceCanManage(workspaceId, user.id);
    } catch (error) {
      if (isPermissionChangedError(error)) {
        return permissionChangedResponse();
      }
      throw error;
    }

    await removeWorkspaceMember({ workspaceId, userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
    console.error("Failed to remove member:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to remove member"
    ).toResponse();
  }
}
