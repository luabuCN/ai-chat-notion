import { auth } from "@/app/(auth)/auth";
import { extractPdfContent } from "@/lib/pdf/extract-pdf";
import { uploadImagesToStorage } from "@/lib/pdf/upload-images";
import { convertToMarkdown } from "@/lib/pdf/convert-to-markdown";
import { polishWithAI } from "@/lib/pdf/polish-with-ai";

export const maxDuration = 120;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

type SseEvent =
  | { type: "progress"; message: string }
  | { type: "done"; markdown: string; rawMarkdown: string; pageCount: number }
  | { type: "error"; message: string };

function sseChunk(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (file.type !== "application/pdf") {
    return new Response(
      JSON.stringify({ error: "Only PDF files are supported" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return new Response(
      JSON.stringify({ error: "File size must be less than 20MB" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const buffer = await file.arrayBuffer();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(event)));
      };

      try {
        // 1. 解析 PDF 文字 + 图片坐标（同时提取原始图片像素数据）
        send({ type: "progress", message: "正在提取 PDF 文字和图片位置..." });
        const { pageContents, rawImages } = await extractPdfContent(buffer.slice(0));

        // 2. 并发上传图片（直接用解析阶段的像素数据，无需重新加载 PDF）
        send({
          type: "progress",
          message: `共 ${pageContents.length} 页，正在上传 ${rawImages.length} 张图片...`,
        });
        const pageContentsWithImages = await uploadImagesToStorage(
          pageContents,
          rawImages
        );

        // 3. 转换为 Markdown
        send({ type: "progress", message: "正在转换为 Markdown 格式..." });
        const rawMarkdown = convertToMarkdown(pageContentsWithImages);

        // 4. AI 优化（ModelScope 需流式才有正文；失败或空结果则降级为原始 markdown）
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
