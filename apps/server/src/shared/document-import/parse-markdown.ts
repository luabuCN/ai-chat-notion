import { markdownFromBuffer } from "./normalize-markdown.js";
import { polishImportMarkdown } from "./polish-import-markdown.js";
import type { ImportedDocument, ImportPolishMode } from "./types.js";

export async function parseMarkdownDocument(
  buffer: ArrayBuffer,
  title: string,
  polish: ImportPolishMode = "auto"
): Promise<ImportedDocument> {
  const { markdown: rawMarkdown, hadFrontmatter } = markdownFromBuffer(buffer);
  const warnings: string[] = [];

  if (hadFrontmatter) {
    warnings.push("YAML frontmatter 已从导入内容中移除。");
  }

  const markdown = await polishImportMarkdown("markdown", rawMarkdown, polish);

  return {
    kind: "markdown",
    title,
    contentFormat: "markdown",
    markdown,
    rawMarkdown,
    warnings,
  };
}
