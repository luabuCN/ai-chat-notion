import { Editor, Content } from "@tiptap/react";
import { defaultExtensions } from "../tiptap/default-extensions";

export function useEditorExport() {
  const exportDocument = async (content: Content, fileName: string) => {
    // 创建临时 Editor 实例来加载内容并转换为 Markdown
    const tempEditor = new Editor({
      extensions: defaultExtensions,
      content: content,
    });

    // 等待编辑器初始化完成
    await new Promise((resolve) => {
      if (tempEditor.isEditable) {
        resolve(true);
      } else {
        tempEditor.on("create", () => resolve(true));
      }
    });

    // 使用 tiptap-markdown 扩展获取 Markdown 内容
    const markdownContent = tempEditor.getMarkdown();

    // 销毁临时编辑器
    tempEditor.destroy();

    // 创建 Blob 并触发下载
    const blob = new Blob([markdownContent], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName.endsWith(".md") ? fileName : `${fileName}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { exportDocument };
}
