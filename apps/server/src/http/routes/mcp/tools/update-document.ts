import { z } from "zod";
import {
  getEditorDocumentById,
  updateEditorDocument,
} from "@repo/database";
import { textToYjsState } from "../../../../shared/text-to-yjs.js";
import { cacheDel, CACHE_KEYS } from "../../../../shared/redis-cache.js";
import type { ToolContext } from "./types.js";
import { textResult, errorResult } from "./types.js";

/** 注册 update_document 工具 */
export function registerUpdateDocumentTool(ctx: ToolContext) {
  ctx.server.tool(
    "update_document",
    "修改指定文档的标题和/或内容。需要传入文档 ID，至少提供 title 或 content 之一。内容支持 Markdown 格式。",
    {
      documentId: z
        .string()
        .uuid()
        .describe("要修改的文档 ID（UUID 格式）"),
      title: z.string().optional().describe("新标题（可选）"),
      content: z
        .string()
        .optional()
        .describe("新内容，支持 Markdown 格式（可选）"),
    },
    async ({ documentId, title, content }) => {
      try {
        if (!title && content === undefined) {
          return errorResult("至少需要提供 title 或 content");
        }

        const document = await getEditorDocumentById({ id: documentId });

        if (document.userId !== ctx.session.user.id) {
          return errorResult("无权修改此文档");
        }

        // 如果提供了 content，转换为 Tiptap JSON + Yjs 状态
        let tiptapContent: string | undefined;
        let yjsState: Uint8Array<ArrayBuffer> | undefined;

        if (content !== undefined) {
          const result = textToYjsState(content);
          tiptapContent = result.content;
          yjsState = result.yjsState;
        }

        const updated = await updateEditorDocument({
          id: documentId,
          title,
          content: tiptapContent,
          yjsState,
          lastEditedBy: ctx.session.user.id,
          lastEditedByName: ctx.session.user.name || "Unknown",
        });

        // 清除 Redis 缓存中的 yjsState，使下次加载从 DB 读取新内容
        if (yjsState) {
          await cacheDel(CACHE_KEYS.yjsState(documentId));
        }

        return textResult(
          JSON.stringify({
            id: updated.id,
            title: updated.title,
            content: updated.content,
            updatedAt: updated.updatedAt,
          }),
        );
      } catch {
        return errorResult("文档不存在");
      }
    },
  );
}
