import { createImportEditor } from "./import-editor";

export function htmlToTiptap(html: string) {
  const editor = createImportEditor();

  try {
    editor.commands.setContent(html, { emitUpdate: false });
    return editor.getJSON();
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to parse HTML content"
    );
  } finally {
    editor.destroy();
  }
}
