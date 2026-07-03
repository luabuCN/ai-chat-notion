import type { Context } from "hono";
import { getSessionFromRequest } from "../../../shared/auth.js";
import {
  isMarkdownImportFile,
  parseImportDocument,
} from "../../../shared/document-import/parse-document.js";
import type {
  ImportContentFormat,
  ImportFileKind,
  ImportPolishMode,
} from "../../../shared/document-import/types.js";
import { ApiError } from "../../../shared/errors.js";
import { enqueueDocumentImportJob } from "../../../jobs/queues.js";
import { isJobQueueEnabled } from "../../../jobs/connection.js";

const MAX_PDF_OR_DOCX_SIZE = 20 * 1024 * 1024;
const MAX_MARKDOWN_SIZE = 5 * 1024 * 1024;

type SseEvent =
  | { type: "progress"; message: string }
  | {
      type: "done";
      kind: ImportFileKind;
      title: string;
      contentFormat: ImportContentFormat;
      markdown: string;
      rawMarkdown: string;
      html?: string;
      pageCount?: number;
      warnings: string[];
    }
  | { type: "error"; message: string };

function sseChunk(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function getPolishMode(value: FormDataEntryValue | null): ImportPolishMode {
  return value === "always" || value === "never" ? value : "auto";
}

function assertFileSize(file: File) {
  const maxSize = isMarkdownImportFile(file)
    ? MAX_MARKDOWN_SIZE
    : MAX_PDF_OR_DOCX_SIZE;

  if (file.size > maxSize) {
    const limit = isMarkdownImportFile(file) ? "5MB" : "20MB";
    throw new Error(`文件大小不能超过 ${limit}`);
  }
}

async function uploadImportFile(file: File) {
  const { UTApi } = await import("uploadthing/server");
  const utapi = new UTApi();
  const response = await utapi.uploadFiles(file);

  if (response.error || !response.data) {
    throw new Error(response.error?.message || "文件上传失败");
  }

  return {
    url: response.data.url,
    key: response.data.key,
    contentType: response.data.type || file.type,
  };
}

async function deleteUploadedImportFile(fileKey: string) {
  const { UTApi } = await import("uploadthing/server");
  const utapi = new UTApi();
  await utapi.deleteFiles(fileKey);
}

export async function createDocumentImportJobHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  if (!isJobQueueEnabled()) {
    return c.json(
      { error: "Job queue is not available. Use /parse instead." },
      503
    );
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const docId = formData.get("docId") as string | null;
  const polish = getPolishMode(formData.get("polish"));

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }
  if (!docId) {
    return c.json({ error: "docId is required" }, 400);
  }

  try {
    assertFileSize(file);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "文件大小超出限制" },
      400
    );
  }

  let uploadedFileKey: string | null = null;

  try {
    const uploaded = await uploadImportFile(file);
    uploadedFileKey = uploaded.key;
    const record = await enqueueDocumentImportJob({
      userId: session.user.id,
      docId,
      fileUrl: uploaded.url,
      fileName: file.name,
      mimeType: uploaded.contentType || file.type,
      polish,
    });

    if (!record) {
      throw new Error("Failed to enqueue import job");
    }

    return c.json({ jobId: record.jobId, docId }, 202);
  } catch (error) {
    if (uploadedFileKey) {
      await deleteUploadedImportFile(uploadedFileKey).catch((cleanupError) => {
        console.error("[document-import/jobs] cleanup failed", cleanupError);
      });
    }

    console.error("[document-import/jobs]", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "无法创建导入任务",
      },
      500
    );
  }
}

export async function parseDocumentImportHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const polish = getPolishMode(formData.get("polish"));

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  try {
    assertFileSize(file);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "文件大小超出限制" },
      400
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: SseEvent) => {
        controller.enqueue(new TextEncoder().encode(sseChunk(event)));
      };

      try {
        send({ type: "progress", message: "正在解析文档..." });
        const result = await parseImportDocument(file, polish);

        send({
          type: "done",
          kind: result.kind,
          title: result.title,
          contentFormat: result.contentFormat,
          markdown: result.markdown,
          rawMarkdown: result.rawMarkdown ?? result.markdown,
          html: result.html,
          pageCount: result.stats?.pageCount,
          warnings: result.warnings,
        });
      } catch (error) {
        console.error("[document-import/parse]", error);
        send({
          type: "error",
          message:
            error instanceof Error ? error.message : "文档解析失败，请重试",
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
