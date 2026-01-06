import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";

// ==================== Workspace Functions ====================

export async function createWorkspace({
  name,
  slug,
  icon,
  ownerId,
}: {
  name: string;
  slug: string;
  icon?: string;
  ownerId: string;
}) {
  try {
    const workspace = await prisma.workspace.create({
      data: {
        name,
        slug,
        icon,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: "owner",
          },
        },
      },
    });
    return workspace;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create workspace"
    );
  }
}

export async function getWorkspaceById({ id }: { id: string }) {
  try {
    return await prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true } },
      },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get workspace");
  }
}

export async function getWorkspaceBySlug({ slug }: { slug: string }) {
  try {
    return await prisma.workspace.findUnique({
      where: { slug },
      include: {
        _count: { select: { members: true } },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get workspace by slug"
    );
  }
}

export async function getWorkspacesByUserId({ userId }: { userId: string }) {
  try {
    return await prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { role: true, permission: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get workspaces");
  }
}

export async function updateWorkspace({
  id,
  name,
  icon,
}: {
  id: string;
  name?: string;
  icon?: string | null;
}) {
  try {
    return await prisma.workspace.update({
      where: { id },
      data: { name, icon },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update workspace"
    );
  }
}

export async function deleteWorkspace({ id }: { id: string }) {
  try {
    return await prisma.workspace.delete({
      where: { id },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete workspace"
    );
  }
}

export async function getWorkspaceMember({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  try {
    return await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  } catch (_error) {
    return null;
  }
}

/**
 * 获取用户在工作空间的权限信息
 * 返回角色、权限级别和是否为所有者
 */
export async function getWorkspaceMemberPermission({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<{
  role: string;
  permission: string;
  isOwner: boolean;
} | null> {
  try {
    // 同时获取成员信息和工作空间所有者信息
    const [member, workspace] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        select: { role: true, permission: true },
      }),
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { ownerId: true },
      }),
    ]);

    if (!member) return null;

    return {
      role: member.role,
      permission: member.permission,
      isOwner: workspace?.ownerId === userId,
    };
  } catch (_error) {
    return null;
  }
}

export async function getWorkspaceMembers({
  workspaceId,
}: {
  workspaceId: string;
}) {
  try {
    return await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get workspace members"
    );
  }
}

export async function addWorkspaceMember({
  workspaceId,
  userId,
  role = "member",
}: {
  workspaceId: string;
  userId: string;
  role?: string;
}) {
  try {
    return await prisma.workspaceMember.create({
      data: { workspaceId, userId, role },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to add workspace member"
    );
  }
}

export async function updateWorkspaceMemberRole({
  workspaceId,
  userId,
  role,
  permission,
}: {
  workspaceId: string;
  userId: string;
  role?: string;
  permission?: string;
}) {
  try {
    const data: { role?: string; permission?: string } = {};
    if (role !== undefined) data.role = role;
    if (permission !== undefined) data.permission = permission;

    return await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId } },
      data,
      include: {
        user: {
          select: { id: true, email: true, name: true, avatarUrl: true },
        },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update member role"
    );
  }
}

export async function removeWorkspaceMember({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}) {
  try {
    return await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to remove workspace member"
    );
  }
}

// 生成唯一的 workspace slug
export function generateWorkspaceSlug(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 6; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// 检查用户是否有访问空间的权限
export async function hasWorkspaceAccess({
  workspaceId,
  userId,
}: {
  workspaceId: string;
  userId: string;
}): Promise<boolean> {
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (!workspace) return false;
    if (workspace.ownerId === userId) return true;

    const member = await getWorkspaceMember({ workspaceId, userId });
    return member !== null;
  } catch (_error) {
    return false;
  }
}

// 检查两个用户是否共享任何工作空间
export async function doUsersShareWorkspace({
  userId1,
  userId2,
}: {
  userId1: string;
  userId2: string;
}): Promise<boolean> {
  try {
    // 查找同时包含两个用户的工作空间
    const sharedWorkspace = await prisma.workspace.findFirst({
      where: {
        AND: [
          {
            OR: [
              { ownerId: userId1 },
              { members: { some: { userId: userId1 } } },
            ],
          },
          {
            OR: [
              { ownerId: userId2 },
              { members: { some: { userId: userId2 } } },
            ],
          },
        ],
      },
    });
    return sharedWorkspace !== null;
  } catch (_error) {
    return false;
  }
}
