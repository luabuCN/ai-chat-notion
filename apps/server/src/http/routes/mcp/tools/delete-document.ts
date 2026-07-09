import { z } from "zod";
import {
  getEditorDocumentById,
  softDeleteEditorDocument,
  deleteEditorDocument,
} from "@repo/database";
import type { ToolContext } from "./types.js";
import { textResult, errorResult } from "./types.js";

/** 注册 delete_document 工具 */
export function registerDeleteDocumentTool(ctx: ToolContext) {
  ctx.server.tool(
    "delete_document",
    "删除指定文档。默认为软删除（移入回收站），设置 permanent=true 则永久删除。需要传入文档 ID。",
    {
      documentId: z
        .string()
        .uuid()
        .describe("要删除的文档 ID（UUID 格式）"),
      permanent: z
        .boolean()
        .optional()
        .describe("是否永久删除（默认 false，移入回收站）"),
    },
    async ({ documentId, permanent }) => {
      try {
        const document = await getEditorDocumentById({ id: documentId });

        if (document.userId !== ctx.session.user.id) {
          return errorResult("无权删除此文档");
        }

        if (permanent) {
          await deleteEditorDocument({ id: documentId });
          return textResult(
            JSON.stringify({
              id: documentId,
              title: document.title,
              deleted: true,
              permanent: true,
            }),
          );
        } else {
          await softDeleteEditorDocument({ id: documentId });
          return textResult(
            JSON.stringify({
              id: documentId,
              title: document.title,
              deleted: true,
              permanent: false,
            }),
          );
        }
      } catch {
        return errorResult("文档不存在");
      }
    },
  );
}
