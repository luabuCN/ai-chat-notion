import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { prisma } from "@repo/database";

/**
 * GET /api/editor-documents/shared-with-me
 * 获取当前用户被邀请协作的文档列表和访问过的公开文档（按所有者分组）
 */
export async function GET(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  try {
    // 1. 获取当前用户被邀请的文档
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
            isPublished: true,
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

    // 2. 获取当前用户访问过的公开文档（排除自己的和已被邀请的）
    const invitedDocumentIds = collaborators.map((c) => c.document.id);
    const visitors = await prisma.documentVisitor.findMany({
      where: {
        userId: user.id,
        document: {
          isPublished: true,
          userId: { not: user.id },
          id: { notIn: invitedDocumentIds },
        },
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
            isPublished: true,
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
        visitedAt: "desc",
      },
    });

    // 3. 按邀请者（文档所有者）分组
    const groupedByOwner: Record<
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
          isPublic: boolean;
        }>;
      }
    > = {};

    // 添加被邀请的文档
    for (const collaborator of collaborators) {
      const ownerId = collaborator.document.userId;
      const ownerEmail = collaborator.document.user.email || "";
      const ownerName =
        collaborator.document.user.name ||
        ownerEmail.split("@")[0] ||
        "未知用户";

      if (!groupedByOwner[ownerId]) {
        groupedByOwner[ownerId] = {
          ownerId,
          ownerName,
          ownerEmail,
          documents: [],
        };
      }

      groupedByOwner[ownerId].documents.push({
        id: collaborator.document.id,
        title: collaborator.document.title,
        icon: collaborator.document.icon,
        workspaceId: collaborator.document.workspaceId,
        updatedAt: collaborator.document.updatedAt,
        lastEditedByName: collaborator.document.lastEditedByName,
        permission: collaborator.permission,
        isPublic: false,
      });
    }

    // 添加访问过的公开文档
    for (const visitor of visitors) {
      const ownerId = visitor.document.userId;
      const ownerEmail = visitor.document.user.email || "";
      const ownerName =
        visitor.document.user.name || ownerEmail.split("@")[0] || "未知用户";

      if (!groupedByOwner[ownerId]) {
        groupedByOwner[ownerId] = {
          ownerId,
          ownerName,
          ownerEmail,
          documents: [],
        };
      }

      groupedByOwner[ownerId].documents.push({
        id: visitor.document.id,
        title: visitor.document.title,
        icon: visitor.document.icon,
        workspaceId: visitor.document.workspaceId,
        updatedAt: visitor.document.updatedAt,
        lastEditedByName: visitor.document.lastEditedByName,
        permission: "view", // 公开文档只有查看权限
        isPublic: true,
      });
    }

    // 4. 转换为数组并按文档数量排序
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
