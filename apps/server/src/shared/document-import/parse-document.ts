import { convertToMarkdown } from "../pdf/convert-to-markdown.js";
import { extractPdfContent } from "../pdf/extract-pdf.js";
import { uploadImagesToStorage } from "../pdf/upload-images.js";
import { parseDocxDocument } from "./parse-docx.js";
import { parseMarkdownDocument } from "./parse-markdown.js";
import { polishImportMarkdown } from "./polish-import-markdown.js";
import type { ImportedDocument, ImportFileKind, ImportPolishMode } from "./types.js";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isMarkdownFileName(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown");
}

export function inferImportFileKind(file: File): ImportFileKind | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }
  if (type === DOCX_MIME || name.endsWith(".docx")) {
    return "docx";
  }
  if (
    type === "text/markdown" ||
    type === "text/x-markdown" ||
    name.endsWith(".md") ||
    name.endsWith(".markdown")
  ) {
    return "markdown";
  }
  if (type === "text/plain" && isMarkdownFileName(file.name)) {
    return "markdown";
  }

  return null;
}

export function isMarkdownImportFile(file: File): boolean {
  return inferImportFileKind(file) === "markdown";
}

export function titleFromFileName(fileName: string): string {
  return (
    fileName
      .replace(/\.(pdf|docx|md|markdown)$/i, "")
      .trim() || "未命名文档"
  );
}

async function parsePdfDocument(
  buffer: ArrayBuffer,
  title: string,
  polish: ImportPolishMode
): Promise<ImportedDocument> {
  const { pageContents, rawImages } = await extractPdfContent(buffer.slice(0));
  const pageContentsWithImages = await uploadImagesToStorage(pageContents, rawImages);
  const rawMarkdown = convertToMarkdown(pageContentsWithImages);
  const markdown = await polishImportMarkdown("pdf", rawMarkdown, polish);

  return {
    kind: "pdf",
    title,
    contentFormat: "markdown",
    markdown,
    rawMarkdown,
    warnings: [],
    stats: {
      pageCount: pageContents.length,
      imageCount: rawImages.length,
    },
  };
}

export async function parseImportDocument(
  file: File,
  polish: ImportPolishMode = "auto"
): Promise<ImportedDocument> {
  const kind = inferImportFileKind(file);
  if (!kind) {
    throw new Error("仅支持 PDF、Word DOCX、Markdown 文件");
  }

  const title = titleFromFileName(file.name);
  const buffer = await file.arrayBuffer();

  if (kind === "pdf") {
    return parsePdfDocument(buffer, title, polish);
  }
  if (kind === "docx") {
    return parseDocxDocument(buffer, title, polish);
  }
  return parseMarkdownDocument(buffer, title, polish);
}
