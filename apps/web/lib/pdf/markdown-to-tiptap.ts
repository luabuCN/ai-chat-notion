/**
 * 将 Markdown 文本转换为 Tiptap JSON 格式。
 *
 * 支持：
 * - # ## ### 标题
 * - - / * / 1. 列表项
 * - | 表格行（简化为段落）
 * - ![alt](url) 图片
 * - 普通段落（空行分隔）
 */

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

type TiptapDoc = {
  type: "doc";
  content: TiptapNode[];
};

/** 解析单行内联内容（文字 + 图片混合） */
function parseInlineContent(line: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  // 匹配 ![alt](url) 图片
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const text = line.slice(lastIndex, match.index);
      if (text) nodes.push({ type: "text", text });
    }
    nodes.push({
      type: "image",
      attrs: { src: match[2], alt: match[1] || null, title: null },
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    const text = line.slice(lastIndex);
    if (text) nodes.push({ type: "text", text });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text: line }];
}

export function markdownToTiptapJson(markdown: string): TiptapDoc {
  const lines = markdown.split("\n");
  const content: TiptapNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 空行 → 跳过（段落由非空行决定）
    if (!line.trim()) {
      i++;
      continue;
    }

    // 标题
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInlineContent(headingMatch[2]),
      });
      i++;
      continue;
    }

    // 无序列表项
    const ulMatch = /^[-*+]\s+(.+)$/.exec(line);
    if (ulMatch) {
      const listItems: TiptapNode[] = [];
      while (i < lines.length) {
        const itemMatch = /^[-*+]\s+(.+)$/.exec(lines[i]);
        if (!itemMatch) break;
        listItems.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInlineContent(itemMatch[1]),
            },
          ],
        });
        i++;
      }
      content.push({ type: "bulletList", content: listItems });
      continue;
    }

    // 有序列表项
    const olMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (olMatch) {
      const listItems: TiptapNode[] = [];
      while (i < lines.length) {
        const itemMatch = /^\d+\.\s+(.+)$/.exec(lines[i]);
        if (!itemMatch) break;
        listItems.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInlineContent(itemMatch[1]),
            },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", attrs: { start: 1 }, content: listItems });
      continue;
    }

    // 表格行（简化：每行作为一个段落，保留原始文字）
    if (line.trim().startsWith("|")) {
      // 跳过分隔行 |---|---|
      if (/^\|[-|\s:]+\|$/.test(line.trim())) {
        i++;
        continue;
      }
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const text = cells.join("  |  ");
      content.push({
        type: "paragraph",
        content: parseInlineContent(text),
      });
      i++;
      continue;
    }

    // 纯图片行
    if (/^!\[/.test(line.trim())) {
      const inlineNodes = parseInlineContent(line.trim());
      // 如果只有一个图片节点，单独作为段落
      content.push({ type: "paragraph", content: inlineNodes });
      i++;
      continue;
    }

    // 普通段落
    content.push({
      type: "paragraph",
      content: parseInlineContent(line),
    });
    i++;
  }

  // 确保文档不为空
  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}
