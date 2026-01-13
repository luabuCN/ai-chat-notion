import { Database } from "@hocuspocus/extension-database";
import { PrismaClient } from "@prisma/client";
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
import { gzipSync, gunzipSync } from "zlib";

// 直接创建 Prisma 客户端
const prisma = new PrismaClient();

// 压缩阈值：超过 50KB 的文档启用压缩
const COMPRESSION_THRESHOLD = 50 * 1024;

/**
 * 检测 Buffer 是否为 gzip 压缩格式（检查 magic bytes）
 */
function isGzipCompressed(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

// 自定义 Server 端扩展，确保与客户端行为一致（特别是属性解析）
const ServerHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      level: {
        default: 1,
        parseHTML: (element) => {
          const level = element.getAttribute("level");
          return level ? parseInt(level, 10) : 1;
        },
      },
    };
  },
});

const ServerTable = Table.configure({
  resizable: true,
});

const ServerTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      colwidth: {
        default: null,
        parseHTML: (element) => {
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
        parseHTML: (element) => {
          const colwidth = element.getAttribute("colwidth");
          return colwidth
            ? colwidth.split(",").map((w) => parseInt(w, 10))
            : null;
        },
      },
    };
  },
});

// 定义转换器使用的 Extensions
const transformerExtensions = [
  StarterKit.configure({
    heading: false, // 使用自定义 Heading
    // @ts-ignore: history option might be missing in type definition
    history: false, // 服务端不需要历史记录
  }),
  ServerHeading,
  ServerTable,
  TableRow,
  ServerTableHeader,
  ServerTableCell,
  Image,
  TaskList,
  TaskItem,
];

/**
 * Database 扩展：将 Yjs 文档状态持久化到 PostgreSQL
 */
export const databaseExtension = new Database({
  /**
   * 从数据库获取文档
   */
  fetch: async ({ documentName }) => {
    console.log(`[Database] Fetching document: ${documentName}`);

    try {
      const doc = await prisma.editorDocument.findUnique({
        where: { id: documentName },
        select: {
          yjsState: true,
          content: true,
        },
      });

      if (!doc) {
        console.log(`[Database] Document ${documentName} not found`);
        return null;
      }

      // 1. 如果有 Yjs 状态，尝试使用它
      if (doc.yjsState && doc.yjsState.length > 0) {
        // 检测并解压缩
        let stateBuffer = Buffer.from(doc.yjsState);
        if (isGzipCompressed(stateBuffer)) {
          console.log(
            `[Database] Decompressing Yjs state for ${documentName}, compressed size: ${stateBuffer.length} bytes`
          );
          stateBuffer = gunzipSync(stateBuffer);
          console.log(
            `[Database] Decompressed size: ${stateBuffer.length} bytes`
          );
        } else {
          console.log(
            `[Database] Found existing Yjs state for ${documentName}, size: ${doc.yjsState.length} bytes`
          );
        }
        return stateBuffer;
      }

      // 递归清洗 JSON 内容，确保属性类型正确
      function cleanJsonContent(json: any): any {
        if (!json || typeof json !== "object") {
          return json;
        }

        if (Array.isArray(json)) {
          return json.map(cleanJsonContent);
        }

        const cleanNode = { ...json };

        // 修复 Heading level (确保为数字)
        if (cleanNode.type === "heading" && cleanNode.attrs) {
          if (typeof cleanNode.attrs.level === "string") {
            cleanNode.attrs.level = parseInt(cleanNode.attrs.level, 10);
          }
        }

        // 递归处理 content
        if (cleanNode.content) {
          cleanNode.content = cleanJsonContent(cleanNode.content);
        }

        return cleanNode;
      }

      // 2. 如果没有 Yjs 状态但有 JSON 内容，使用 Transformer 转换
      if (doc.content) {
        console.log(
          `[Database] Converting JSON content to Yjs for ${documentName}`
        );
        try {
          let jsonContent = JSON.parse(doc.content);

          // 清洗 JSON 内容（修复 heading level 等）
          jsonContent = cleanJsonContent(jsonContent);

          // 使用 TiptapTransformer 转换 JSON -> YDoc
          // @ts-ignore: TiptapTransformer type definition mismatch
          const ydoc = TiptapTransformer.toYdoc(
            jsonContent,
            "default", // field name
            transformerExtensions
          );

          const state = Y.encodeStateAsUpdate(ydoc);
          console.log(
            `[Database] Converted Yjs state size: ${state.length} bytes`
          );
          ydoc.destroy();
          return Buffer.from(state);
        } catch (error) {
          console.error(
            `[Database] Failed to convert content for ${documentName}:`,
            error
          );
        }
      }

      console.log(`[Database] No content found for ${documentName}`);
      return null;
    } catch (error) {
      console.error(
        `[Database] Error fetching document ${documentName}:`,
        error
      );
      throw error;
    }
  },

  /**
   * 保存文档到数据库
   */
  store: async ({ documentName, state, context }) => {
    console.log(`[Database] Storing document: ${documentName}`);

    try {
      // 1. 恢复 YDoc
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, state);

      // 2. 转换为 Tiptap JSON (用于 content 字段，保持非协同模式兼容)
      let jsonContent: string | undefined;
      try {
        const json = TiptapTransformer.fromYdoc(ydoc, "default");
        jsonContent = JSON.stringify(json);
      } catch (e) {
        console.warn(`[Database] Could not convert Yjs to JSON:`, e);
      }

      ydoc.destroy();

      // 3. 更新数据库（大文档启用压缩）
      let stateBuffer = Buffer.from(state);
      if (state.length > COMPRESSION_THRESHOLD) {
        const compressedBuffer = gzipSync(stateBuffer);
        console.log(
          `[Database] Compressing large document ${documentName}: ${
            state.length
          } -> ${compressedBuffer.length} bytes (${Math.round(
            (1 - compressedBuffer.length / state.length) * 100
          )}% reduction)`
        );
        stateBuffer = compressedBuffer;
      }

      // 3. 更新数据库
      await prisma.editorDocument.update({
        where: { id: documentName },
        data: {
          yjsState: stateBuffer,
          ...(jsonContent && { content: jsonContent }),
          ...(context?.user && {
            lastEditedBy: context.user.id,
            lastEditedByName: context.user.name,
          }),
        },
      });

      console.log(`[Database] Document ${documentName} stored successfully`);
    } catch (error) {
      console.error(
        `[Database] Error storing document ${documentName}:`,
        error
      );
      throw error;
    }
  },
});
