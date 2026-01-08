import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { prisma } from "@repo/database";

/**
 * POST /api/editor-documents/[id]/visit
 * 记录用户访问公开文档
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
    // 获取文档信息
    const document = await prisma.editorDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        isPublished: true,
        userId: true,
      },
    });

    if (!document) {
      return new ChatSDKError("not_found:document").toResponse();
    }

    // 只记录公开的、非自己的文档
    if (!document.isPublished || document.userId === user.id) {
      return Response.json({ success: true, tracked: false }, { status: 200 });
    }

    // 使用 upsert 来避免重复记录
    await prisma.documentVisitor.upsert({
      where: {
        documentId_userId: {
          documentId,
          userId: user.id,
        },
      },
      update: {
        visitedAt: new Date(),
      },
      create: {
        documentId,
        userId: user.id,
      },
    });

    return Response.json({ success: true, tracked: true }, { status: 200 });
  } catch (error) {
    console.error("[Visit] Error recording visit:", error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to record document visit"
    ).toResponse();
  }
}
