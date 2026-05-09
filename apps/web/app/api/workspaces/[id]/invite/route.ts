import { auth } from "@/app/(auth)/auth";
import { prisma } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";
import {
  assertWorkspaceCanManage,
  isPermissionChangedError,
  permissionChangedResponse,
} from "@/lib/permission-assert";

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

  // 校验当前用户是否有管理权限（owner/admin）
  try {
    await assertWorkspaceCanManage(id, session.user.id);
  } catch (error) {
    if (isPermissionChangedError(error)) {
      return permissionChangedResponse();
    }
    throw error;
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
