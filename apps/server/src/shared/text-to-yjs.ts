import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { StarterKit } from "@tiptap/starter-kit";
import { Heading } from "@tiptap/extension-heading";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { UniqueID } from "@tiptap/extension-unique-id";

// 与 collab/extensions/database.ts 对齐的 Tiptap 扩展
const ServerHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      level: {
        default: 1,
        parseHTML: (element: HTMLElement) => {
          const level = element.getAttribute("level");
          return level ? parseInt(level, 10) : 1;
        },
      },
    };
  },
});

const ServerTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const colwidth = element.getAttribute("colwidth");
          return colwidth
            ? colwidth.split(",").map((w) => parseInt(w, 10))
            : null;
        },
      },
    };
  },
});

const ServerTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const colwidth = element.getAttribute("colwidth");
          return colwidth
            ? colwidth.split(",").map((w) => parseInt(w, 10))
            : null;
        },
      },
    };
  },
});

const ServerBlockUniqueId = UniqueID.configure({
  types: [
    "paragraph",
    "heading",
    "blockquote",
    "codeBlock",
    "table",
    "listItem",
    "taskItem",
  ],
  attributeName: "id",
});

const transformerExtensions = [
  StarterKit.configure({
    heading: false,
    // @ts-ignore: history option might be missing in type definition
    history: false,
  }),
  ServerBlockUniqueId,
  ServerHeading,
  Table.configure({ resizable: true }),
  TableRow,
  ServerTableHeader,
  ServerTableCell,
  Image,
  TaskList,
  TaskItem,
];

// ─── 内联格式解析 ─────────────────────────────────────────────────────

type TextNode = { type: "text"; text: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> };

/**
 * 解析内联格式：**粗体**、*斜体*、`代码`、[链接](url)
 */
function parseInlineText(text: string): TextNode[] {
  if (!text) return [];

  const nodes: TextNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2] !== undefined) {
      nodes.push({ type: "text", marks: [{ type: "bold" }], text: match[2] });
    } else if (match[3] !== undefined) {
      nodes.push({ type: "text", marks: [{ type: "italic" }], text: match[3] });
    } else if (match[4] !== undefined) {
      nodes.push({ type: "text", marks: [{ type: "code" }], text: match[4] });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      nodes.push({ type: "text", marks: [{ type: "link", attrs: { href: match[6] } }], text: match[5] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

/** 构建段落节点（自动解析内联格式） */
function makeParagraph(text: string): Record<string, unknown> {
  const inlineNodes = parseInlineText(text);
  return {
    type: "paragraph",
    ...(inlineNodes.length > 0 ? { content: inlineNodes } : {}),
  };
}

// ─── Markdown 表格解析 ────────────────────────────────────────────────

/** 检测一行是否为 Markdown 表格分隔行（如 |---|---|） */
function isTableSeparator(line: string): boolean {
  const cleaned = line.trim().replace(/^\||\|$/g, "").trim();
  return /^[\s-:|]+$/.test(cleaned) && cleaned.includes("-");
}

/** 解析一行表格单元格 */
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** 解析 Markdown 表格并返回 Tiptap table 节点 */
function parseTable(lines: string[], startIndex: number): { node: Record<string, unknown>; nextIndex: number } {
  const rawLines: string[] = [];
  let i = startIndex;

  // 收集所有表格行（以 | 开头）
  while (i < lines.length && lines[i].trim().startsWith("|")) {
    rawLines.push(lines[i]);
    i++;
  }

  if (rawLines.length < 2) {
    // 不足 2 行不算表格，回退
    return { node: makeParagraph(lines[startIndex]), nextIndex: startIndex + 1 };
  }

  // 第一行是表头
  const headerCells = parseTableRow(rawLines[0]);

  // 确定数据行起始位置：如果第二行是分隔符，跳过
  let dataStartIndex = 1;
  if (isTableSeparator(rawLines[1])) {
    dataStartIndex = 2;
  }

  const dataRows = rawLines.slice(dataStartIndex).map(parseTableRow);

  // 构建表头行
  const headerRow = {
    type: "tableRow",
    content: headerCells.map((cell) => ({
      type: "tableHeader",
      attrs: { colwidth: null },
      content: [makeParagraph(cell)],
    })),
  };

  // 构建数据行
  const bodyRows = dataRows.map((row) => ({
    type: "tableRow",
    content: row.map((cell) => ({
      type: "tableCell",
      attrs: { colwidth: null },
      content: [makeParagraph(cell)],
    })),
  }));

  return {
    node: {
      type: "table",
      content: [headerRow, ...bodyRows],
    },
    nextIndex: i,
  };
}

// ─── Markdown → Tiptap JSON ───────────────────────────────────────────

/**
 * 将纯文本/简易 Markdown 转换为 Tiptap JSON 文档。
 * 支持：标题(#/##/###)、无序列表(-/*)、有序列表(1.)、代码块(```)、表格(|...|)、引用(>)、内联格式(**粗体** *斜体* `代码` [链接](url))。
 */
function textToTiptapJson(text: string): Record<string, unknown> {
  const lines = text.split("\n");
  const content: Record<string, unknown>[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 代码块
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      content.push({
        type: "codeBlock",
        attrs: { language: lang || null },
        content: codeLines.length > 0
          ? [{ type: "text", text: codeLines.join("\n") }]
          : undefined,
      });
      continue;
    }

    // 表格（以 | 开头的行）
    if (line.trim().startsWith("|")) {
      const { node, nextIndex } = parseTable(lines, i);
      content.push(node);
      i = nextIndex;
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInlineText(headingMatch[2]),
      });
      i++;
      continue;
    }

    // 引用块
    if (/^>\s+/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s+/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s+/, ""));
        i++;
      }
      content.push({
        type: "blockquote",
        content: quoteLines.map((qLine) => makeParagraph(qLine)),
      });
      continue;
    }

    // 无序列表
    if (/^[-*]\s+/.test(line)) {
      const items: Record<string, unknown>[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, "");
        items.push({
          type: "listItem",
          content: [makeParagraph(itemText)],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      const items: Record<string, unknown>[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [makeParagraph(itemText)],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // 空行 → 跳过
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 普通段落
    content.push(makeParagraph(line));
    i++;
  }

  // 空文档至少有一个空段落
  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

/**
 * 将纯文本/Markdown 转换为 Tiptap JSON 字符串。
 * 仅生成 content，不生成 yjsState。编辑器打开文档时会自动将 content 转为 Yjs。
 */
export function textToTiptapContent(text: string): string {
  return JSON.stringify(textToTiptapJson(text || ""));
}

/**
 * 将纯文本/Markdown 转换为 Tiptap JSON + Yjs 二进制状态。
 * @deprecated MCP 工具不再需要 yjsState，请使用 textToTiptapContent 代替。
 */
export function textToYjsState(text: string): {
  content: string;
  yjsState: Uint8Array<ArrayBuffer>;
} {
  const tiptapJson = textToTiptapJson(text || "");
  const contentStr = JSON.stringify(tiptapJson);

  // 使用 TiptapTransformer 将 JSON 转为 Yjs doc
  // @ts-ignore: TiptapTransformer type definition mismatch
  const ydoc = TiptapTransformer.toYdoc(tiptapJson, "default", transformerExtensions);
  const rawState = Y.encodeStateAsUpdate(ydoc);
  ydoc.destroy();

  // 复制到新的 ArrayBuffer 支持的 Uint8Array，确保 Prisma 兼容
  const state = new Uint8Array(rawState.byteLength);
  state.set(rawState);

  return {
    content: contentStr,
    yjsState: state,
  };
}
