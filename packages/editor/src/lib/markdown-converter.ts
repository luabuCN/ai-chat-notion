import { Editor } from "@tiptap/core";
import { defaultExtensions } from "../tiptap/default-extensions";

export function markdownToTiptap(markdown: string) {
  // Create a headless editor instance with the same extensions as the main editor
  const editor = new Editor({
    extensions: defaultExtensions,
    editable: false,
  });

  try {
    // access the markdown extension storage
    // Based on markdown-paste.ts, it uses `manager`
    const manager = editor.storage.markdown?.manager;

    if (manager) {
      const json = manager.parse(markdown);
      editor.destroy();
      return json;
    }

    // Fallback or try parser directly if manager is custom or different version
    const parser = (editor.storage.markdown as any)?.parser;
    if (parser) {
      const json = parser.parse(markdown);
      editor.destroy();
      return json;
    }

    console.warn(
      "Markdown extension storage not found or missing parser/manager"
    );
  } catch (error) {
    console.error("Error parsing markdown:", error);
  }

  // Fallback: behavior if parsing fails (return simple paragraph)
  const json = editor.getJSON();
  editor.destroy();
  return json;
}
