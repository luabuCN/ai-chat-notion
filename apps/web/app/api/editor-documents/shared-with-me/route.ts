import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { prisma } from "@repo/database";

/**
 * GET /api/editor-documents/shared-with-me
 * 获取当前用户被邀请协作的文档列表（按邀请者分组）
 */
export async function GET(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    // 获取当前用户被邀请的文档
    const collaborators = await prisma.documentCollaborator.findMany({
      where: {
        email: user.email,
        status: "accepted",
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            userId: true,
            workspaceId: true,
            updatedAt: true,
            lastEditedByName: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        document: {
          updatedAt: "desc",
        },
      },
    });

    // 按邀请者（文档所有者）分组
    const groupedByOwner = collaborators.reduce(
      (acc, collaborator) => {
        const ownerId = collaborator.document.userId;
        const ownerEmail = collaborator.document.user.email || "";
        const ownerName = collaborator.document.user.name || ownerEmail.split("@")[0] || "未知用户";

        if (!acc[ownerId]) {
          acc[ownerId] = {
            ownerId,
            ownerName,
            ownerEmail,
            documents: [],
          };
        }

        acc[ownerId].documents.push({
          id: collaborator.document.id,
          title: collaborator.document.title,
          icon: collaborator.document.icon,
          workspaceId: collaborator.document.workspaceId,
          updatedAt: collaborator.document.updatedAt,
          lastEditedByName: collaborator.document.lastEditedByName,
          permission: collaborator.permission,
        });

        return acc;
      },
      {} as Record<
        string,
        {
          ownerId: string;
          ownerName: string;
          ownerEmail: string;
          documents: Array<{
            id: string;
            title: string;
            icon: string | null;
            workspaceId: string | null;
            updatedAt: Date;
            lastEditedByName: string | null;
            permission: string;
          }>;
        }
      >
    );

    // 转换为数组并按文档数量排序
    const result = Object.values(groupedByOwner).sort(
      (a, b) => b.documents.length - a.documents.length
    );

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get shared documents"
    ).toResponse();
  }
}

