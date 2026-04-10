import { tool } from "ai";
import { z } from "zod";
import { getEditorDocumentById } from "@repo/database";

export const viewDocument = tool({
  description:
    "查看用户文档库中的文档内容。当用户在消息中提到某个文档，或者你需要查看用户文档库中的文档时使用此工具。注意：不要用此工具查看你刚通过 createDocument 创建的 artifact 文档，两者是不同的系统。",
  inputSchema: z.object({
    documentId: z.string().uuid().describe("要查看的文档 ID"),
  }),
  execute: async ({ documentId }) => {
    try {
      const doc = await getEditorDocumentById({ id: documentId });
      return {
        id: doc.id,
        title: doc.title,
        icon: doc.icon,
        content: doc.content || "(空文档)",
      };
    } catch {
      return {
        error: `无法找到 ID 为 ${documentId} 的文档，请确认文档 ID 是否正确。`,
      };
    }
  },
});
