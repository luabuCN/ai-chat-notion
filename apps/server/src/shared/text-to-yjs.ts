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

/**
 * 将纯文本/简易 Markdown 转换为 Tiptap JSON 文档。
 * 支持：标题(#/##/###)、无序列表(-/*)、有序列表(1.)、代码块(```)、普通段落。
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

    // 标题
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      content.push({
        type: "heading",
        attrs: { level },
        content: [{ type: "text", text: headingMatch[2] }],
      });
      i++;
      continue;
    }

    // 无序列表
    if (/^[-*]\s+/.test(line)) {
      const items: Record<string, unknown>[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^[-*]\s+/, "");
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: itemText ? [{ type: "text", text: itemText }] : undefined,
            },
          ],
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
          content: [
            {
              type: "paragraph",
              content: itemText ? [{ type: "text", text: itemText }] : undefined,
            },
          ],
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
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    });
    i++;
  }

  // 空文档至少有一个空段落
  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

/**
 * 将纯文本/Markdown 转换为 Tiptap JSON + Yjs 二进制状态。
 * 返回 { content: Tiptap JSON 字符串, yjsState: Uint8Array<ArrayBuffer> }。
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
  // (Y.encodeStateAsUpdate 返回 Uint8Array<ArrayBufferLike>，Prisma 需要 Uint8Array<ArrayBuffer>)
  const state = new Uint8Array(rawState.byteLength);
  state.set(rawState);

  return {
    content: contentStr,
    yjsState: state,
  };
}
