import { getAuthFromRequest } from "@/lib/api-auth";
import { ChatSDKError } from "@/lib/errors";
import { verifyWorkspaceAccess } from "@/lib/workspace-access";
import { prisma } from "@repo/database";
import {
  getEditorDocumentsByUserId,
} from "@repo/database";

/**
 * 统一的文档项类型，标注了来源
 */
export interface AllDocumentItem {
  id: string;
  title: string;
  icon: string | null;
  parentDocumentId: string | null;
  source: "workspace" | "shared" | "trash";
  permission: string | null;
  ownerName: string | null;
  updatedAt: string;
  deletedAt: string | null;
  hasChildren: boolean;
  isFavorite: boolean;
}

/**
 * GET /api/editor-documents/all
 * 聚合当前空间文档、他人分享文档、回收站文档，返回统一结构
 * 支持 ?workspaceId=xxx 和 ?parentDocumentId=xxx（用于懒加载子文档）
 * ?flat=true 且带 workspaceId 时返回该空间内全部未删除文档（含子页面），用于搜索/快速打开
 */
export async function GET(request: Request) {
  const { user } = getAuthFromRequest(request);

  if (!user) {
    return new ChatSDKError("unauthorized:document").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  const parentDocumentId = searchParams.get("parentDocumentId");
  const wantFlat =
    searchParams.get("flat") === "true" || searchParams.get("flat") === "1";

  // 如果指定了 workspaceId，验证访问权限
  if (workspaceId) {
    const hasAccess = await verifyWorkspaceAccess(workspaceId);
    if (!hasAccess) {
      return new ChatSDKError(
        "unauthorized:document",
        "Access denied"
      ).toResponse();
    }
  }

  try {
    const result: AllDocumentItem[] = [];

    // 如果传了 parentDocumentId，说明是在懒加载某个文档的子文档
    // 此时只返回空间文档的子文档（分享文档和回收站文档不展示层级）
    if (parentDocumentId) {
      const children = await getEditorDocumentsByUserId({
        userId: user.id,
        workspaceId: workspaceId ?? undefined,
        parentDocumentId,
        includeDeleted: false,
        onlyDeleted: false,
      });

      // 查询这些子文档有无各自的子文档
      const childIds = children.map((d) => d.id);
      const childrenCounts = await prisma.editorDocument.groupBy({
        by: ["parentDocumentId"],
        where: {
          parentDocumentId: { in: childIds },
          deletedAt: null,
        },
        _count: true,
      });
      const hasChildrenMap = new Map(
        childrenCounts.map((c) => [c.parentDocumentId, c._count > 0])
      );

      for (const doc of children) {
        result.push({
          id: doc.id,
          title: doc.title,
          icon: doc.icon,
          parentDocumentId: doc.parentDocumentId,
          source: "workspace",
          permission: "edit",
          ownerName: null,
          updatedAt: new Date(doc.updatedAt).toISOString(),
          deletedAt: null,
          hasChildren: hasChildrenMap.get(doc.id) ?? false,
          isFavorite: doc.isFavorite,
        });
      }

      return Response.json(result, { status: 200 });
    }

    // === 顶层查询：聚合三个数据源 ===

    // 1. 空间文档
    if (wantFlat && workspaceId) {
      const workspaceDocsFlat = await prisma.editorDocument.findMany({
        where: {
          workspaceId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          icon: true,
          parentDocumentId: true,
          updatedAt: true,
          isFavorite: true,
        },
        orderBy: { updatedAt: "desc" },
      });

      const flatIds = workspaceDocsFlat.map((d) => d.id);
      const childrenCountsFlat =
        flatIds.length > 0
          ? await prisma.editorDocument.groupBy({
              by: ["parentDocumentId"],
              where: {
                parentDocumentId: { in: flatIds },
                deletedAt: null,
              },
              _count: true,
            })
          : [];
      const flatHasChildrenMap = new Map(
        childrenCountsFlat.map((c) => [c.parentDocumentId, c._count > 0])
      );

      for (const doc of workspaceDocsFlat) {
        result.push({
          id: doc.id,
          title: doc.title,
          icon: doc.icon,
          parentDocumentId: doc.parentDocumentId,
          source: "workspace",
          permission: "edit",
          ownerName: null,
          updatedAt: new Date(doc.updatedAt).toISOString(),
          deletedAt: null,
          hasChildren: flatHasChildrenMap.get(doc.id) ?? false,
          isFavorite: doc.isFavorite,
        });
      }
    } else {
      const workspaceDocs = await getEditorDocumentsByUserId({
        userId: user.id,
        workspaceId: workspaceId ?? undefined,
        parentDocumentId: null,
        includeDeleted: false,
        onlyDeleted: false,
      });

      const workspaceDocIds = workspaceDocs.map((d) => d.id);
      const childrenCountsForWorkspace =
        workspaceDocIds.length > 0
          ? await prisma.editorDocument.groupBy({
              by: ["parentDocumentId"],
              where: {
                parentDocumentId: { in: workspaceDocIds },
                deletedAt: null,
              },
              _count: true,
            })
          : [];
      const wsHasChildrenMap = new Map(
        childrenCountsForWorkspace.map((c) => [
          c.parentDocumentId,
          c._count > 0,
        ])
      );

      for (const doc of workspaceDocs) {
        result.push({
          id: doc.id,
          title: doc.title,
          icon: doc.icon,
          parentDocumentId: doc.parentDocumentId,
          source: "workspace",
          permission: "edit",
          ownerName: null,
          updatedAt: new Date(doc.updatedAt).toISOString(),
          deletedAt: null,
          hasChildren: wsHasChildrenMap.get(doc.id) ?? false,
          isFavorite: doc.isFavorite,
        });
      }
    }

    // 2. 他人分享的文档
    const collaborators = await prisma.documentCollaborator.findMany({
      where: {
        email: user.email,
        status: "accepted",
        document: { deletedAt: null },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            workspaceId: true,
            updatedAt: true,
            isFavorite: true,
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
    });

    // 已有邀请文档 ID 集合
    const invitedDocIds = new Set(collaborators.map((c) => c.document.id));

    // 访问过的公开文档
    const visitors = await prisma.documentVisitor.findMany({
      where: {
        userId: user.id,
        document: {
          OR: [{ isPublished: true }, { isPubliclyEditable: true }],
          deletedAt: null,
          userId: { not: user.id },
          id: { notIn: Array.from(invitedDocIds) },
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            icon: true,
            workspaceId: true,
            updatedAt: true,
            isFavorite: true,
            isPubliclyEditable: true,
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
    });

    // 如果指定了当前空间，排除在该空间中的文档
    const filteredCollab = workspaceId
      ? collaborators.filter((c) => c.document.workspaceId !== workspaceId)
      : collaborators;
    const filteredVisitors = workspaceId
      ? visitors.filter((v) => v.document.workspaceId !== workspaceId)
      : visitors;

    for (const c of filteredCollab) {
      result.push({
        id: c.document.id,
        title: c.document.title,
        icon: c.document.icon,
        parentDocumentId: null,
        source: "shared",
        permission: c.permission,
        ownerName:
          c.document.user.name ||
          c.document.user.email?.split("@")[0] ||
          "未知用户",
        updatedAt: new Date(c.document.updatedAt).toISOString(),
        deletedAt: null,
        hasChildren: false,
        isFavorite: c.document.isFavorite,
      });
    }

    for (const v of filteredVisitors) {
      result.push({
        id: v.document.id,
        title: v.document.title,
        icon: v.document.icon,
        parentDocumentId: null,
        source: "shared",
        permission: v.document.isPubliclyEditable ? "edit" : "view",
        ownerName:
          v.document.user.name ||
          v.document.user.email?.split("@")[0] ||
          "未知用户",
        updatedAt: new Date(v.document.updatedAt).toISOString(),
        deletedAt: null,
        hasChildren: false,
        isFavorite: v.document.isFavorite,
      });
    }

    // 3. 回收站文档
    const trashDocs = await getEditorDocumentsByUserId({
      userId: user.id,
      workspaceId: workspaceId ?? undefined,
      parentDocumentId: null,
      includeDeleted: false,
      onlyDeleted: true,
    });

    for (const doc of trashDocs) {
      result.push({
        id: doc.id,
        title: doc.title,
        icon: doc.icon,
        parentDocumentId: doc.parentDocumentId,
        source: "trash",
        permission: "edit",
        ownerName: null,
        updatedAt: new Date(doc.updatedAt).toISOString(),
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt).toISOString() : null,
        hasChildren: false,
        isFavorite: doc.isFavorite,
      });
    }

    // 按 updatedAt 降序排列
    result.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new ChatSDKError(
      "bad_request:api",
      "Failed to get all documents"
    ).toResponse();
  }
}
