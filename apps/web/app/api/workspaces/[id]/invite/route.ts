import { auth } from "@/app/(auth)/auth";
import { prisma } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";

// POST /api/workspaces/[id]/invite - 创建特定邀请
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id } = await params;
  const { email, role, permission } = await request.json();

  // 验证权限：只有管理员可以邀请
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: id,
        userId: session.user.id,
      },
    },
    include: { workspace: true },
  });

  // 必须是空间成员且(是拥有者 或 虽主要看拥有者但此处简化为只要在列表里且后续可能加role判断，目前假设拥有者或admin角色)
  // 简单起见，这里先检查是否是 owner
  // 注意：Schema 中 Workspace 有 ownerId。
  const isOwner = member?.workspace.ownerId === session.user.id;

  // 或者我们可以检查 member.role === 'admin' 如果我们有这个字段 (Schema 里有 role)
  const isAdmin = member?.role === "admin" || isOwner;

  if (!isAdmin) {
    return new ChatSDKError(
      "forbidden:chat",
      "Only admins can invite"
    ).toResponse();
  }

  // Generate new unique token for this specific invite
  const token = nanoid(12);

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

  return NextResponse.json({
    token: invite.token,
    inviteCode: invite.token, // Maintain compatibility if frontend expects this key
  });
}

// GET (Optional) - 如果还需要获取通用邀请码，可以保留或修改。
// 目前这里只处理 POST 创建特定的。
