import type { Job } from "bullmq";
import { parseImportDocument } from "../../shared/document-import/parse-document.js";
import type { ImportPolishMode } from "../../shared/document-import/types.js";
import { patchJobStatus } from "../status.js";
import type { DocumentImportJobData } from "../types.js";

async function fetchFileFromUrl(
  fileUrl: string,
  fileName: string,
  mimeType: string
): Promise<File> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error("无法下载待解析文件");
  }

  const buffer = await response.arrayBuffer();
  return new File([buffer], fileName, { type: mimeType });
}

export async function processDocumentImportJob(
  job: Job<DocumentImportJobData>
): Promise<unknown> {
  const { fileUrl, fileName, mimeType, polish, docId } = job.data;

  await patchJobStatus(job.id!, {
    status: "processing",
    progress: "正在解析文档...",
  });

  const file = await fetchFileFromUrl(fileUrl, fileName, mimeType);
  const result = await parseImportDocument(
    file,
    polish as ImportPolishMode
  );

  const payload = {
    docId,
    kind: result.kind,
    title: result.title,
    contentFormat: result.contentFormat,
    markdown: result.markdown,
    rawMarkdown: result.rawMarkdown ?? result.markdown,
    html: result.html,
    pageCount: result.stats?.pageCount,
    warnings: result.warnings,
  };

  await patchJobStatus(job.id!, {
    status: "completed",
    progress: "解析完成",
    result: payload,
  });

  return payload;
}
