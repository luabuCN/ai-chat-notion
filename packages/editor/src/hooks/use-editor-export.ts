import { Editor, Content } from "@tiptap/react";
import { defaultExtensions } from "../tiptap/default-extensions";

export function useEditorExport() {
  const exportDocument = async (
    content: Content,
    fileName: string,
    format: "markdown" | "pdf"
  ) => {
    if (format === "markdown") {
      
    } else if (format === "pdf") {
      // PDF 导出功能待实现
    }
  };

  return { exportDocument };
}
