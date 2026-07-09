import { z } from "zod";
import {
  createEditorDocument,
  getWorkspaceBySlug,
} from "@repo/database";
import { verifyWorkspaceAccess } from "../../../../shared/workspace-access.js";
import { textToTiptapContent } from "../../../../shared/text-to-yjs.js";
import type { ToolContext } from "./types.js";
import { textResult, errorResult, buildDocumentUrl, getDefaultWorkspaceId } from "./types.js";

/** 注册 create_document 工具 */
export function registerCreateDocumentTool(ctx: ToolContext) {
  ctx.server.tool(
    "create_document",
    "创建一个新文档。传入标题和内容（Markdown 格式），可选传入目标空间 slug。不传空间则创建到默认空间。",
    {
      title: z.string().describe("文档标题"),
      content: z
        .string()
        .optional()
        .describe("文档内容，支持 Markdown 格式（标题、列表、代码块等）"),
      workspaceSlug: z
        .string()
        .optional()
        .describe("目标空间 slug（可选，不传则创建到默认空间）"),
    },
    async ({ title, content, workspaceSlug }) => {
      try {
        let workspaceId: string | null = null;

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
        } else {
          // 不传空间时，使用用户的默认空间
          const defaultId = await getDefaultWorkspaceId(ctx.session.user.id);
          if (defaultId) {
            workspaceId = defaultId;
          }
        }

        // 将文本内容转换为 Tiptap JSON（不生成 yjsState，编辑器打开时自动转换）
        const tiptapContent = textToTiptapContent(content ?? "");

        const document = await createEditorDocument({
          title,
          content: tiptapContent,
          userId: ctx.session.user.id,
          workspaceId,
        });

        return textResult(
          JSON.stringify({
            id: document.id,
            title: document.title,
            workspaceId: document.workspaceId,
            url: buildDocumentUrl(document.id),
          }),
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "创建文档失败";
        return errorResult(message);
      }
    },
  );
}
