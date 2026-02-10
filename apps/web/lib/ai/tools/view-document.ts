import { tool } from "ai";
import { z } from "zod";
import { getEditorDocumentById } from "@repo/database";

// viewDocument tool：让 AI 能够主动查看 workspace 中的文档内容
export const viewDocument = tool({
  description:
    "查看一个文档的完整内容。当用户在消息中通过 @ 提到了某个文档，或者你需要查看某个文档的内容时使用此工具。输入文档 ID 即可获取文档的标题和内容。",
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
