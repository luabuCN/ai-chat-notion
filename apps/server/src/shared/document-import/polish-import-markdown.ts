import { polishWithAI } from "../pdf/polish-with-ai.js";
import type { ImportFileKind, ImportPolishMode } from "./types.js";

export function shouldPolishImport(
  kind: ImportFileKind,
  polish: ImportPolishMode
): boolean {
  if (polish === "never") {
    return false;
  }
  if (polish === "always") {
    return true;
  }
  return kind === "pdf";
}

export async function polishImportMarkdown(
  kind: ImportFileKind,
  markdown: string,
  polish: ImportPolishMode
): Promise<string> {
  if (!shouldPolishImport(kind, polish)) {
    return markdown;
  }
  return polishWithAI(markdown);
}
