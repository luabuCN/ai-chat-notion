import { z } from "zod";
import {
  getEditorDocumentById,
  getWorkspacesByUserId,
} from "@repo/database";
import type { ToolContext } from "./types.js";
import { textResult, errorResult } from "./types.js";

/** 注册 get_document 工具 */
export function registerGetDocumentTool(ctx: ToolContext) {
  ctx.server.tool(
    "get_document",
    "获取指定文档的内容。需要传入文档 ID。返回标题、内容、所属空间等信息。",
    {
      documentId: z
        .string()
        .uuid()
        .describe("要查看的文档 ID（UUID 格式）"),
    },
    async ({ documentId }) => {
      try {
        const document = await getEditorDocumentById({ id: documentId });

        if (document.userId !== ctx.session.user.id) {
          return errorResult("无权访问此文档");
        }

        // 查找文档所属空间名称
        let workspaceName: string | null = null;
        let workspaceSlug: string | null = null;
        if (document.workspaceId) {
          const workspaces = await getWorkspacesByUserId({
            userId: ctx.session.user.id,
          });
          const ws = workspaces.find((w) => w.id === document.workspaceId);
          workspaceName = ws?.name ?? null;
          workspaceSlug = ws?.slug ?? null;
        }

        return textResult(
          JSON.stringify({
            id: document.id,
            title: document.title,
            icon: document.icon,
            content: document.content || "(空文档)",
            workspaceId: document.workspaceId,
            workspaceName,
            workspaceSlug,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
          }),
        );
      } catch {
        return errorResult("文档不存在");
      }
    },
  );
}
