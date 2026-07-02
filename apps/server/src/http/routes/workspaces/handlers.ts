import type { Context } from "hono";
import {
  createWorkspace,
  getWorkspacesByUserId,
  getWorkspaceBySlug,
  getWorkspaceById,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  updateWorkspace,
  deleteWorkspace,
  generateWorkspaceSlug,
  updateUserCurrentWorkspace,
  hasWorkspaceAccess,
  createNotification,
} from "@repo/database";
import { broadcast } from "../../../ws/connection-pool.js";
import { generateDefaultWorkspaceName } from "@repo/database/workspace-name";
import { prisma } from "@repo/database";
import { randomBytes } from "node:crypto";
import { addDays } from "date-fns";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import { isSameEmail } from "../../../shared/utils.js";
import {
  assertWorkspaceCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "../../../shared/permission-assert.js";
import {
  cacheGet,
  cacheSet,
  cacheDel,
  CACHE_KEYS,
  CACHE_TTL,
} from "../../../shared/redis-cache.js";
import {
  collectWorkspaceUserIds,
  invalidateUserMembershipCaches,
  invalidateWsListForUser,
  invalidateWsListForWorkspace,
} from "../../../shared/workspace-cache.js";

function roleToChinese(role: string | null | undefined): string {
  switch (role) {
    case "admin": return "管理员";
    case "member": return "成员";
    default: return role ?? "成员";
  }
}

function permissionToChinese(perm: string | null | undefined): string {
  switch (perm) {
    case "edit": return "编辑";
    case "view": return "查看";
    default: return perm ?? "查看";
  }
}

async function afterWorkspaceMemberRemoved({
  userId,
  workspaceId,
}: {
  userId: string;
  workspaceId: string;
}) {
  await invalidateUserMembershipCaches(userId);
  await invalidateWsListForWorkspace(workspaceId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentWorkspaceId: true },
  });

  if (user?.currentWorkspaceId !== workspaceId) {
    return;
  }

  const remainingWorkspaces = await getWorkspacesByUserId({ userId });
  const defaultWorkspace =
    remainingWorkspaces.find((workspace) => workspace.ownerId === userId) ??
    remainingWorkspaces[0];

  await updateUserCurrentWorkspace({
    userId,
    workspaceId: defaultWorkspace?.id ?? null,
  });
}

// ─── Root routes ─────────────────────────────────────────────────────────────

export async function listWorkspacesHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    // 尝试从缓存读取
    const cacheKey = CACHE_KEYS.wsList(session.user.id);
    const cached = await cacheGet<unknown[]>(cacheKey);
    if (cached) {
      return c.json(cached);
    }

    let workspaces = await getWorkspacesByUserId({ userId: session.user.id });

    // Auto-create default workspace if user has none
    if (workspaces.length === 0) {
      const slug = generateWorkspaceSlug();
      const workspace = await createWorkspace({
        name: generateDefaultWorkspaceName(session.user.name),
        slug,
        ownerId: session.user.id,
      });

      await updateUserCurrentWorkspace({
        userId: session.user.id,
        workspaceId: workspace.id,
      });

      workspaces = [workspace as any];
    }

    // 写入缓存
    await cacheSet(cacheKey, workspaces, CACHE_TTL.wsList);

    return c.json(workspaces);
  } catch (error) {
    console.error("Failed to get workspaces:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to get workspaces"
    ).toResponse();
  }
}

export async function createWorkspaceHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const { name, icon } = await c.req.json();

    if (!name || typeof name !== "string") {
      return new ApiError(
        "bad_request:api",
        "Name is required"
      ).toResponse();
    }

    // Generate unique slug
    let slug = generateWorkspaceSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = await getWorkspaceBySlug({ slug });
      if (!existing) break;
      slug = generateWorkspaceSlug();
      attempts++;
    }

    const workspace = await createWorkspace({
      name: name.trim(),
      slug,
      icon,
      ownerId: session.user.id,
    });

    // 失效工作空间列表缓存
    await invalidateWsListForUser(session.user.id);

    await updateUserCurrentWorkspace({
      userId: session.user.id,
      workspaceId: workspace.id,
    });

    return c.json(workspace, 201);
  } catch (error) {
    console.error("Failed to create workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to create workspace"
    ).toResponse();
  }
}

export async function updateWorkspaceHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const { id, name, icon } = await c.req.json();

    if (!id) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID is required"
      ).toResponse();
    }

    const workspace = await updateWorkspace({
      id,
      name: name?.trim(),
      icon,
    });

    await invalidateWsListForWorkspace(id);

    return c.json(workspace);
  } catch (error) {
    console.error("Failed to update workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to update workspace"
    ).toResponse();
  }
}

export async function deleteWorkspaceHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const searchParams = new URL(c.req.url).searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID is required"
      ).toResponse();
    }

    const affectedUserIds = await collectWorkspaceUserIds(id);
    await deleteWorkspace({ id });
    await Promise.all(
      affectedUserIds.map((userId) => invalidateUserMembershipCaches(userId))
    );

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to delete workspace"
    ).toResponse();
  }
}

// ─── Parameterized routes ────────────────────────────────────────────────────

export async function updateWorkspaceByIdHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const id = c.req.param("id")!;
    const { name, icon } = await c.req.json();

    const workspace = await updateWorkspace({
      id,
      name: name?.trim(),
      icon,
    });

    await invalidateWsListForWorkspace(id);

    return c.json(workspace);
  } catch (error) {
    console.error("Failed to update workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to update workspace"
    ).toResponse();
  }
}

export async function deleteWorkspaceByIdHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const id = c.req.param("id")!;
    const affectedUserIds = await collectWorkspaceUserIds(id);
    await deleteWorkspace({ id });
    await Promise.all(
      affectedUserIds.map((userId) => invalidateUserMembershipCaches(userId))
    );

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to delete workspace"
    ).toResponse();
  }
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembersHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const searchParams = new URL(c.req.url).searchParams;
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID is required"
      ).toResponse();
    }

    const hasAccess = await hasWorkspaceAccess({
      workspaceId,
      userId: session.user.id,
    });

    if (!hasAccess) {
      return new ApiError(
        "unauthorized:chat",
        "Access denied"
      ).toResponse();
    }

    const members = await getWorkspaceMembers({ workspaceId });
    return c.json(members);
  } catch (error) {
    console.error("Failed to get workspace members:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to get members"
    ).toResponse();
  }
}

export async function addMemberHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, userId, role = "member", permission } =
      await c.req.json();

    if (!workspaceId || !userId) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    try {
      await assertWorkspaceCanManage(workspaceId, session.user.id);
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
    await invalidateUserMembershipCaches(userId);
    await invalidateWsListForWorkspace(workspaceId);
    return c.json(member, 201);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
    console.error("Failed to add member:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to add member"
    ).toResponse();
  }
}

export async function updateMemberHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, userId, role, permission } = await c.req.json();

    if (!workspaceId || !userId) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    if (!role && !permission) {
      return new ApiError(
        "bad_request:api",
        "Role or permission is required"
      ).toResponse();
    }

    const callerInfo = await assertWorkspaceCanManage(
      workspaceId,
      session.user.id
    );
    const workspace = await getWorkspaceById({ id: workspaceId });

    const members = await getWorkspaceMembers({ workspaceId });
    const targetMember = members.find((m) => m.userId === userId);
    if (!targetMember) {
      return new ApiError(
        "bad_request:api",
        "Member not found"
      ).toResponse();
    }

    // Admin cannot operate on other admins or owners
    if (
      !callerInfo.isOwner &&
      (targetMember.role === "admin" ||
        targetMember.role === "owner" ||
        targetMember.userId === workspace?.ownerId)
    ) {
      return new ApiError(
        "unauthorized:chat",
        "Admin can only update regular members"
      ).toResponse();
    }

    // Cannot change owner's role/permission
    if (userId === workspace?.ownerId) {
      return new ApiError(
        "bad_request:api",
        "Cannot change workspace owner"
      ).toResponse();
    }

    const nextRole = role ?? targetMember.role;
    if (nextRole === "admin" && permission === "view") {
      return new ApiError(
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

    const workspaceInfo = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, slug: true },
    });

    const notification = await createNotification({
      receiverId: userId,
      senderId: session.user.id,
      type: "SPACE_PERMISSION_CHANGED",
      title: `你的空间权限已变更`,
      content: `${workspaceInfo?.name ?? "空间"}: ${roleToChinese(targetMember.role)} → ${roleToChinese(nextRole ?? targetMember.role)}, ${permissionToChinese(targetMember.permission)} → ${permissionToChinese(nextRole === "admin" ? "edit" : permission)}`,
      payload: {
        workspaceId,
        workspaceName: workspaceInfo?.name,
        workspaceSlug: workspaceInfo?.slug,
        oldRole: targetMember.role,
        newRole: nextRole,
        oldPermission: targetMember.permission,
        newPermission: nextRole === "admin" ? "edit" : permission,
      },
    });

    broadcast(userId, {
      type: "new_notification",
      notification,
    });

    await cacheDel(CACHE_KEYS.notifUnread(userId));
    await invalidateUserMembershipCaches(userId);
    await invalidateWsListForWorkspace(workspaceId);

    return c.json(member);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
    console.error("Failed to update member:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to update member"
    ).toResponse();
  }
}

export async function removeMemberHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const searchParams = new URL(c.req.url).searchParams;
    const workspaceId = searchParams.get("workspaceId");
    const userId = searchParams.get("userId");

    if (!workspaceId || !userId) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID and User ID are required"
      ).toResponse();
    }

    // Cannot remove owner
    const workspace = await getWorkspaceById({ id: workspaceId });
    if (!workspace) {
      return new ApiError(
        "bad_request:api",
        "Workspace not found"
      ).toResponse();
    }

    if (userId === workspace.ownerId) {
      return new ApiError(
        "bad_request:api",
        "Cannot remove workspace owner"
      ).toResponse();
    }

    // Self-leave doesn't need management permission
    if (userId === session.user.id) {
      await removeWorkspaceMember({ workspaceId, userId });
      await afterWorkspaceMemberRemoved({ userId, workspaceId });
      return c.json({ success: true });
    }

    // Admin removing other members needs management permission
    try {
      await assertWorkspaceCanManage(workspaceId, session.user.id);
    } catch (error) {
      if (isPermissionChangedError(error)) {
        return permissionChangedResponse();
      }
      throw error;
    }

    await removeWorkspaceMember({ workspaceId, userId });
    await afterWorkspaceMemberRemoved({ userId, workspaceId });

    const workspaceInfo = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, slug: true },
    });

    const notification = await createNotification({
      receiverId: userId,
      senderId: session.user.id,
      type: "SPACE_REMOVED",
      title: `你已被移出空间`,
      content: workspaceInfo?.name ?? null,
      payload: {
        workspaceId,
        workspaceName: workspaceInfo?.name,
        workspaceSlug: workspaceInfo?.slug,
      },
    });

    broadcast(userId, {
      type: "new_notification",
      notification,
    });

    // 失效接收者的未读通知计数缓存
    await cacheDel(CACHE_KEYS.notifUnread(userId));

    return c.json({ success: true });
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
    console.error("Failed to remove member:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to remove member"
    ).toResponse();
  }
}

// ─── Invite ──────────────────────────────────────────────────────────────────

export async function createInviteHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const id = c.req.param("id")!;
  const { email, role, permission } = await c.req.json();

  if (!email) {
    return new ApiError("bad_request:api", "Email is required").toResponse();
  }

  if (isSameEmail(email, session.user.email)) {
    return new ApiError(
      "bad_request:api",
      "不能邀请自己的邮箱"
    ).toResponse();
  }

  try {
    await assertWorkspaceCanManage(id, session.user.id);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
    throw error;
  }

  // Generate new unique token for this specific invite
  const token = randomBytes(6).toString("hex");

  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId: id,
      email,
      role: role || "member",
      permission: permission || "view",
      token,
      expiresAt: addDays(new Date(), 7), // 7 days expiration
    },
  });

  // Look up invited user by email to send notification
  const invitedUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (invitedUser) {
    const ws = await prisma.workspace.findUnique({
      where: { id },
      select: { name: true },
    });

    const notification = await createNotification({
      receiverId: invitedUser.id,
      senderId: session.user.id,
      type: "SPACE_INVITE",
      title: `${session.user.name} 邀请你加入空间「${ws?.name ?? "未知空间"}」`,
      content: ws?.name ?? null,
      payload: {
        workspaceId: id,
        workspaceName: ws?.name,
        inviteToken: invite.token,
        role: role || "member",
        permission: permission || "view",
      },
    });

    broadcast(invitedUser.id, {
      type: "new_notification",
      notification,
    });

    // 失效接收者的未读通知计数缓存
    await cacheDel(CACHE_KEYS.notifUnread(invitedUser.id));
  }

  return c.json({
    token: invite.token,
    inviteCode: invite.token, // Maintain compatibility
  });
}

// ─── Switch ──────────────────────────────────────────────────────────────────

export async function switchWorkspaceHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const { workspaceId, slug } = await c.req.json();

    let targetWorkspaceId = workspaceId;

    // If slug provided instead of ID, look up by slug
    if (!targetWorkspaceId && slug) {
      const workspace = await getWorkspaceBySlug({ slug });
      if (!workspace) {
        return new ApiError(
          "bad_request:api",
          "Workspace not found"
        ).toResponse();
      }
      targetWorkspaceId = workspace.id;
    }

    if (!targetWorkspaceId) {
      return new ApiError(
        "bad_request:api",
        "Workspace ID or slug is required"
      ).toResponse();
    }

    // Check access
    const hasAccess = await hasWorkspaceAccess({
      workspaceId: targetWorkspaceId,
      userId: session.user.id,
    });

    if (!hasAccess) {
      return new ApiError(
        "unauthorized:chat",
        "Access denied"
      ).toResponse();
    }

    await updateUserCurrentWorkspace({
      userId: session.user.id,
      workspaceId: targetWorkspaceId,
    });

    return c.json({ success: true, workspaceId: targetWorkspaceId });
  } catch (error) {
    console.error("Failed to switch workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to switch workspace"
    ).toResponse();
  }
}
