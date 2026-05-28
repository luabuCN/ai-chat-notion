import type { Context } from "hono";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import { extractPdfContent } from "../../../shared/pdf/extract-pdf.js";
import { uploadImagesToStorage } from "../../../shared/pdf/upload-images.js";
import { convertToMarkdown } from "../../../shared/pdf/convert-to-markdown.js";
import { polishWithAI } from "../../../shared/pdf/polish-with-ai.js";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type SseEvent =
  | { type: "progress"; message: string }
  | { type: "done"; markdown: string; rawMarkdown: string; pageCount: number }
  | { type: "error"; message: string };

function sseChunk(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function parsePdfHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }
  if (file.type !== "application/pdf") {
    return c.json({ error: "Only PDF files are supported" }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "File size must be less than 20MB" }, 400);
  }

  const buffer = await file.arrayBuffer();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(event)));
      };

      try {
        send({ type: "progress", message: "正在提取 PDF 文字和图片位置..." });
        const { pageContents, rawImages } = await extractPdfContent(
          buffer.slice(0)
        );

        send({
          type: "progress",
          message: `共 ${pageContents.length} 页，正在上传 ${rawImages.length} 张图片...`,
        });
        const pageContentsWithImages = await uploadImagesToStorage(
          pageContents,
          rawImages
        );

        send({ type: "progress", message: "正在转换为 Markdown 格式..." });
        const rawMarkdown = convertToMarkdown(pageContentsWithImages);

        send({ type: "progress", message: "AI 正在优化排版..." });
        const markdown = await polishWithAI(rawMarkdown);

        send({
          type: "done",
          markdown,
          rawMarkdown,
          pageCount: pageContents.length,
        });
      } catch (error) {
        console.error("[pdf/parse]", error);
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "PDF 解析失败，请重试",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
