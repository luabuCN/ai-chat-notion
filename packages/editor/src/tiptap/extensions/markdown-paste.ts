import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/**
 * 检测文本是否可能是 markdown 格式
 */
function looksLikeMarkdown(text: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/m, // 标题 (# ## ### 等)
    /^#{1,6}[^\s#]/m, // 标题（没有空格的情况，如 ###标题）
    /\*\*[^*]+\*\*/, // 粗体
    /\*[^*]+\*/, // 斜体
    /^[-*+]\s/m, // 无序列表
    /^\d+\.\s/m, // 有序列表
    /^>\s/m, // 引用
    /`[^`]+`/, // 行内代码
    /```[\s\S]*```/, // 代码块
    /\[.+\]\(.+\)/, // 链接
    /^---$/m, // 分隔线
    /^\|.+\|$/m, // 表格
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}

/**
 * 预处理 markdown 文本，修复常见格式问题
 */
function preprocessMarkdown(text: string): string {
  // 修复标题：确保 # 后面有空格
  // 匹配 # 开头但后面不是空格或 # 的情况
  return text.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");
}

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            // 如果有 HTML 内容，让默认处理器处理
            const html = clipboardData.getData("text/html");
            if (html && html.trim()) {
              return false;
            }

            const text = clipboardData.getData("text/plain");
            if (!text) return false;

            // 检测是否是 markdown
            if (!looksLikeMarkdown(text)) {
              return false;
            }

            // 预处理 markdown
            const processedText = preprocessMarkdown(text);

            // 使用 markdown manager 解析
            const manager = editor.storage.markdown?.manager;
            if (!manager) {
              return false;
            }

            try {
              const json = manager.parse(processedText);
              if (json.content && json.content.length > 0) {
                editor.chain().focus().insertContent(json.content).run();
                return true;
              }
            } catch (e) {
              console.error("Failed to parse markdown on paste:", e);
            }

            return false;
          },
        },
      }),
    ];
  },
});
