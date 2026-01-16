import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { verifyDocumentAccess } from "@/lib/document-access";
import { prisma } from "@repo/database";
import crypto from "node:crypto";

/**
 * GET /api/editor-documents/[id]/collaborators
 * 获取文档的所有协作者
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const { access } = await verifyDocumentAccess(
      documentId,
      user.id,
      user.email
    );

    // 只有 owner 和 edit 权限才能查看协作者列表
    if (access !== "owner" && access !== "edit") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const collaborators = await prisma.documentCollaborator.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(collaborators, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get collaborators"
    ).toResponse();
  }
}

/**
 * POST /api/editor-documents/[id]/collaborators
 * 邀请新协作者
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    const { access } = await verifyDocumentAccess(
      documentId,
      user.id,
      user.email
    );

    // 只有 owner 才能邀请协作者
    if (access !== "owner") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    const body = await request.json();
    const { email, permission = "edit" } = body as {
      email: string;
      permission?: "view" | "edit";
    };

    if (!email) {
      return new ChatSDKError(
        "bad_request:api",
        "Email is required"
      ).toResponse();
    }

    // 检查是否已经邀请过
    const existing = await prisma.documentCollaborator.findUnique({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
    });

    if (existing) {
      return new ChatSDKError("bad_request:api", "该用户已被邀请").toResponse();
    }

    // 检查被邀请者是否已注册
    const invitedUser = await prisma.user.findFirst({
      where: { email },
    });

    // 生成邀请 token
    const token = crypto.randomBytes(32).toString("hex");

    const collaborator = await prisma.documentCollaborator.create({
      data: {
        documentId,
        email,
        userId: invitedUser?.id,
        permission,
        status: "pending", // 始终为待处理状态,等待用户接受
        invitedBy: user.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天过期
        acceptedAt: null, // 用户接受后才设置
      },
    });

    // TODO: 发送邀请邮件

    return Response.json(collaborator, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to invite collaborator"
    ).toResponse();
  }
}

/**
 * DELETE /api/editor-documents/[id]/collaborators?email=xxx
 * 移除协作者
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(request);
  const { id: documentId } = await params;
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  if (!email) {
    return new ChatSDKError(
      "bad_request:api",
      "Email is required"
    ).toResponse();
  }

  try {
    const { access } = await verifyDocumentAccess(
      documentId,
      user.id,
      user.email
    );

    // 只有 owner 才能移除协作者
    if (access !== "owner") {
      return new ChatSDKError("forbidden:document").toResponse();
    }

    await prisma.documentCollaborator.delete({
      where: {
        documentId_email: {
          documentId,
          email,
        },
      },
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to remove collaborator"
    ).toResponse();
  }
}
