import { prisma } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";

// GET /api/invite/[code] - 获取邀请详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code) {
    return new ChatSDKError("bad_request:api", "Missing code").toResponse();
  }

  // 1. 尝试查找特定邀请 (WorkspaceInvite)
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
    // 检查是否过期
    if (new Date() > specificInvite.expiresAt) {
      return new ChatSDKError("bad_request:api", "Invite expired").toResponse();
    }

    return NextResponse.json({
      workspace: specificInvite.workspace,
      email: specificInvite.email,
      role: specificInvite.role,
      permission: specificInvite.permission,
      isSpecific: true,
    });
  }

  // 2. 尝试查找通用邀请 (Workspace.inviteCode)
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
    return NextResponse.json({
      workspace: genericWorkspace,
      role: "member",
      permission: "view", // 通用链接默认为 view
      isSpecific: false,
    });
  }

  return new ChatSDKError("not_found:chat", "Invalid invite code").toResponse();
}
