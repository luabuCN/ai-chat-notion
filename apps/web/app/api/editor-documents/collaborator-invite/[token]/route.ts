import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { prisma } from "@repo/database";

/**
 * GET /api/editor-documents/collaborator-invite/[token]
 * 获取邀请详情
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: { token },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
          },
        },
      },
    });

    if (!collaborator) {
      return new ChatSDKError("not_found:document", "邀请不存在").toResponse();
    }

    // 检查是否过期
    if (collaborator.expiresAt && collaborator.expiresAt < new Date()) {
      return new ChatSDKError("bad_request:api", "邀请已过期").toResponse();
    }

    return Response.json(
      {
        email: collaborator.email,
        permission: collaborator.permission,
        status: collaborator.status,
        document: collaborator.document,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get invite"
    ).toResponse();
  }
}

/**
 * POST /api/editor-documents/collaborator-invite/[token]
 * 接受邀请
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { token } = await params;

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const collaborator = await prisma.documentCollaborator.findUnique({
      where: { token },
    });

    if (!collaborator) {
      return new ChatSDKError("not_found:document", "邀请不存在").toResponse();
    }

    // 检查邮箱是否匹配
    if (collaborator.email !== user.email) {
      return new ChatSDKError(
        "forbidden:document",
        "此邀请不是发给您的"
      ).toResponse();
    }

    // 检查是否过期
    if (collaborator.expiresAt && collaborator.expiresAt < new Date()) {
      return new ChatSDKError("bad_request:api", "邀请已过期").toResponse();
    }

    // 检查是否已接受
    if (collaborator.status === "accepted") {
      return Response.json(
        { success: true, documentId: collaborator.documentId },
        { status: 200 }
      );
    }

    // 更新状态为已接受
    await prisma.documentCollaborator.update({
      where: { id: collaborator.id },
      data: {
        status: "accepted",
        userId: user.id,
        acceptedAt: new Date(),
      },
    });

    return Response.json(
      { success: true, documentId: collaborator.documentId },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to accept invite"
    ).toResponse();
  }
}

