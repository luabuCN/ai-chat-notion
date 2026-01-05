import { auth } from "@/app/(auth)/auth";
import { prisma } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { NextResponse } from "next/server";

// POST /api/invite/join - 加入空间
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { code } = await request.json();

    if (!code) {
      return new ChatSDKError("bad_request:api", "Missing code").toResponse();
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
        return new ChatSDKError(
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
      return new ChatSDKError(
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

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (existingMember) {
      return NextResponse.json(workspace);
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

    // Mark specific invite as accepted? (Optional, usually we allow multiple uses or single use.
    // Requirement is "Invite System", implied for multiple people?
    // Wait, "Invite specific person" invites usually are one-time or per-email.
    // Given we just generate a link, let's keep it reusable for now or until clicked.
    // If it's a "Copy Link" flow, it might be shared.
    // But if we validated "Invite Name", maybe we should check if session user name matches?
    // User asked to "Verify current username". We'll do that in Frontend mostly, as backend auth name might differ.

    // If we want to record who accepted it:
    if (inviteId) {
      await prisma.workspaceInvite.update({
        where: { id: inviteId },
        data: { acceptedAt: new Date() },
      });
    }

    return NextResponse.json(workspace);
  } catch (error) {
    console.error("Failed to join workspace:", error);
    return new ChatSDKError(
      "bad_request:api",
      "Failed to join workspace"
    ).toResponse();
  }
}
