const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPTED_IMPORT_MIME_TYPES = [
  "application/pdf",
  DOCX_MIME,
  "text/markdown",
  "text/x-markdown",
  "text/plain",
] as const;

export const DOCUMENT_IMPORT_ACCEPT =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,.md,.markdown,text/markdown,text/x-markdown,text/plain";

export const DOCUMENT_IMPORT_EXTENSIONS = /\.(pdf|docx|md|markdown)$/i;

export function isMarkdownImportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".md") || name.endsWith(".markdown");
}

export function isPdfImportFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function isSupportedDocumentImport(file: File): boolean {
  const name = file.name.toLowerCase();

  if (
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".md") ||
    name.endsWith(".markdown")
  ) {
    return true;
  }

  if (file.type === "application/pdf" || file.type === DOCX_MIME) {
    return true;
  }

  if (file.type === "text/markdown" || file.type === "text/x-markdown") {
    return true;
  }

  if (file.type === "text/plain" && isMarkdownImportFile(file)) {
    return true;
  }

  return false;
}

export function getDocumentTitleFromFileName(fileName: string): string {
  return (
    fileName.replace(DOCUMENT_IMPORT_EXTENSIONS, "").trim() || "未命名文档"
  );
}
