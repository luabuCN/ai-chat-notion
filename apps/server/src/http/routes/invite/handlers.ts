import type { Context } from "hono";
import { prisma } from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import {
  invalidateUserMembershipCaches,
  invalidateWsListForWorkspace,
} from "../../../shared/workspace-cache.js";

async function getJoinedWorkspaceForUser(
  workspaceId: string,
  userId: string
) {
  return prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      _count: { select: { members: true } },
      members: {
        where: { userId },
        select: { role: true, permission: true },
      },
    },
  });
}

export async function getInviteHandler(c: Context) {
  const code = c.req.param("code")!;

  if (!code) {
    return new ApiError("bad_request:api", "Missing code").toResponse();
  }

  // 1. Try specific invite (WorkspaceInvite)
  const specificInvite = await prisma.workspaceInvite.findUnique({
    where: { token: code },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          icon: true,
          slug: true,
          _count: { select: { members: true } },
          owner: { select: { name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (specificInvite) {
    if (new Date() > specificInvite.expiresAt) {
      return new ApiError(
        "bad_request:api",
        "Invite expired"
      ).toResponse();
    }

    return c.json({
      workspace: specificInvite.workspace,
      email: specificInvite.email,
      role: specificInvite.role,
      permission: specificInvite.permission,
      isSpecific: true,
    });
  }

  // 2. Try generic invite (Workspace.inviteCode)
  const genericWorkspace = await prisma.workspace.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      icon: true,
      slug: true,
      _count: { select: { members: true } },
      owner: { select: { name: true, avatarUrl: true } },
    },
  });

  if (genericWorkspace) {
    return c.json({
      workspace: genericWorkspace,
      role: "member",
      permission: "view",
      isSpecific: false,
    });
  }

  return new ApiError(
    "not_found:chat",
    "Invalid invite code"
  ).toResponse();
}

export async function joinWorkspaceHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  try {
    const { code } = await c.req.json();

    if (!code) {
      return new ApiError("bad_request:api", "Missing code").toResponse();
    }

    let workspaceId: string | undefined;
    let role = "member";
    let permission = "view";
    let inviteId: string | undefined;

    // 1. Check specific invite
    const specificInvite = await prisma.workspaceInvite.findUnique({
      where: { token: code },
    });

    if (specificInvite) {
      if (new Date() > specificInvite.expiresAt) {
        return new ApiError(
          "bad_request:api",
          "Invite expired"
        ).toResponse();
      }
      workspaceId = specificInvite.workspaceId;
      role = specificInvite.role;
      permission = specificInvite.permission;
      inviteId = specificInvite.id;
    } else {
      // 2. Check generic invite
      const genericWorkspace = await prisma.workspace.findUnique({
        where: { inviteCode: code },
      });
      if (genericWorkspace) {
        workspaceId = genericWorkspace.id;
      }
    }

    if (!workspaceId) {
      return new ApiError(
        "not_found:chat",
        "Invalid invite code"
      ).toResponse();
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: workspaceId,
          userId: session.user.id,
        },
      },
    });

    const workspace = await getJoinedWorkspaceForUser(
      workspaceId,
      session.user.id
    );

    if (!workspace) {
      return new ApiError(
        "not_found:chat",
        "Workspace not found"
      ).toResponse();
    }

    if (existingMember) {
      await invalidateUserMembershipCaches(session.user.id);
      return c.json(workspace);
    }

    // Add member
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: session.user.id,
        role,
        permission,
      },
    });

    // Record specific invite acceptance
    if (inviteId) {
      await prisma.workspaceInvite.update({
        where: { id: inviteId },
        data: { acceptedAt: new Date() },
      });
    }

    await invalidateUserMembershipCaches(session.user.id);
    await invalidateWsListForWorkspace(workspaceId);

    const joinedWorkspace = await getJoinedWorkspaceForUser(
      workspaceId,
      session.user.id
    );

    return c.json(joinedWorkspace);
  } catch (error) {
    console.error("Failed to join workspace:", error);
    return new ApiError(
      "bad_request:api",
      "Failed to join workspace"
    ).toResponse();
  }
}
