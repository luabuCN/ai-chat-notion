import { z } from "zod";
import {
  getEditorDocumentsByUserId,
  getWorkspaceBySlug,
  getWorkspacesByUserId,
} from "@repo/database";
import { verifyWorkspaceAccess } from "../../../../shared/workspace-access.js";
import type { ToolContext } from "./types.js";
import { textResult, errorResult } from "./types.js";

/** 注册 list_documents 工具 */
export function registerListDocumentsTool(ctx: ToolContext) {
  ctx.server.tool(
    "list_documents",
    "列出用户的文档。可选传入空间 slug 以过滤特定空间的文档。返回文档 ID、标题、所属空间等信息。",
    {
      workspaceSlug: z
        .string()
        .optional()
        .describe("空间 slug（可选，不传则列出所有空间的文档）"),
    },
    async ({ workspaceSlug }) => {
      try {
        let workspaceId: string | undefined;

        if (workspaceSlug) {
          const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
          if (!workspace) {
            return errorResult("指定的空间不存在");
          }
          const hasAccess = await verifyWorkspaceAccess(
            workspace.id,
            ctx.session,
          );
          if (!hasAccess) {
            return errorResult("无权访问此空间");
          }
          workspaceId = workspace.id;
        }

        const documents = await getEditorDocumentsByUserId({
          userId: ctx.session.user.id,
          workspaceId,
          parentDocumentId: null,
          includeDeleted: false,
          onlyDeleted: false,
        });

        // 安全过滤：仅返回属于当前用户的文档
        const userDocs = documents.filter(
          (doc) => doc.userId === ctx.session.user.id,
        );

        // 查询用户的所有空间，构建 ID -> { name, slug } 查找映射
        const workspaces = await getWorkspacesByUserId({
          userId: ctx.session.user.id,
        });
        const wsMap = new Map(
          workspaces.map((ws) => [ws.id, { name: ws.name, slug: ws.slug }]),
        );

        return textResult(
          JSON.stringify(
            userDocs.map((doc) => {
              const ws = doc.workspaceId
                ? wsMap.get(doc.workspaceId)
                : undefined;
              return {
                id: doc.id,
                title: doc.title,
                icon: doc.icon,
                workspaceId: doc.workspaceId,
                workspaceName: ws?.name ?? null,
                workspaceSlug: ws?.slug ?? null,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
              };
            }),
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "获取文档列表失败";
        return errorResult(message);
      }
    },
  );
}

