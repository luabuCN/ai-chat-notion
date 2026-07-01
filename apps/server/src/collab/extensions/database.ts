import { Database } from "@hocuspocus/extension-database";
import { prisma } from "@repo/database";
import * as Y from "yjs";
import { TiptapTransformer } from "@hocuspocus/transformer";
import { StarterKit } from "@tiptap/starter-kit";
import {
  verifyDocumentAccess,
  getCachedAccess,
  setCachedAccess,
} from "../auth.js";
import { Heading } from "@tiptap/extension-heading";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { UniqueID } from "@tiptap/extension-unique-id";
import { gzipSync, gunzipSync } from "zlib";
import {
  CACHE_KEYS,
  CACHE_TTL,
  cacheGetBuffer,
  cacheSetBuffer,
} from "../../shared/redis-cache.js";

// 压缩阈值：超过 50KB 的文档启用压缩
const COMPRESSION_THRESHOLD = 50 * 1024;

// 日志条件化：生产环境关闭详细日志
const isDev = process.env.NODE_ENV === "development";
const nativeLog = console.log;
const debugLog = isDev ? nativeLog : () => {};

// JSON content 更新降频：每 N 次 store 才更新一次 content 字段（yjsState 每次都更新）
const JSON_UPDATE_INTERVAL = 5;
const documentStoreCounts = new Map<string, number>();

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

// 与客户端 `default-extensions.ts` 对齐：评论锚点依赖块级 stable id；
// 缺失这条扩展时 `TiptapTransformer.fromYdoc` 会丢掉 `id` 属性，
// 导致非协同模式回到本地后丢失评论锚点。
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

// 定义转换器使用的 Extensions
const transformerExtensions = [
  StarterKit.configure({
    heading: false, // 使用自定义 Heading
    // @ts-ignore: history option might be missing in type definition
    history: false, // 服务端不需要历史记录
  }),
  ServerBlockUniqueId,
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
    debugLog(`[Database] Fetching document: ${documentName}`);

    // 1. 优先查 Redis 缓存（命中则跳过 DB 查询与解压）
    const cacheKey = CACHE_KEYS.yjsState(documentName);
    const cached = await cacheGetBuffer(cacheKey);
    if (cached && cached.length > 0) {
      debugLog(
        `[Database] Redis cache HIT for ${documentName}, size: ${cached.length} bytes`
      );
      return cached;
    }
    debugLog(`[Database] Redis cache MISS for ${documentName}`);

    try {
      const doc = await prisma.editorDocument.findUnique({
        where: { id: documentName },
        select: {
          yjsState: true,
          content: true,
        },
      });

      if (!doc) {
        debugLog(`[Database] Document ${documentName} not found`);
        return null;
      }

      // 2. 如果有 Yjs 状态，尝试使用它
      if (doc.yjsState && doc.yjsState.length > 0) {
        // 检测并解压缩
        let stateBuffer = Buffer.from(doc.yjsState);
        if (isGzipCompressed(stateBuffer)) {
          debugLog(
            `[Database] Decompressing Yjs state for ${documentName}, compressed size: ${stateBuffer.length} bytes`
          );
          stateBuffer = gunzipSync(stateBuffer);
          debugLog(
            `[Database] Decompressed size: ${stateBuffer.length} bytes`
          );
        } else {
          debugLog(
            `[Database] Found existing Yjs state for ${documentName}, size: ${doc.yjsState.length} bytes`
          );
        }
        // 回填 Redis 缓存（存解压后的原始 state，下次命中可直接用）
        await cacheSetBuffer(cacheKey, stateBuffer, CACHE_TTL.yjsState);
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
        debugLog(
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
          debugLog(
            `[Database] Converted Yjs state size: ${state.length} bytes`
          );
          ydoc.destroy();
          const stateBuf = Buffer.from(state);
          // 回填 Redis 缓存
          await cacheSetBuffer(cacheKey, stateBuf, CACHE_TTL.yjsState);
          return stateBuf;
        } catch (error) {
          console.error(
            `[Database] Failed to convert content for ${documentName}:`,
            error
          );
        }
      }

      debugLog(`[Database] No content found for ${documentName}`);
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
   *
   * 持久化前兜底校验：只有 owner/edit 权限的用户才能触发写入
   */
  store: async ({ documentName, state, context }) => {
    debugLog(`[Database] Storing document: ${documentName}`);

    // 兜底校验：确认当前用户仍有写权限
    const user = context?.user;
    if (user?.id) {
      // 先查缓存，命中则跳过 DB 查询
      const cached = getCachedAccess(documentName, user.id, user.email);
      if (cached !== null) {
        if (cached !== "owner" && cached !== "edit") {
          console.warn(
            `[Database] Skipping persist for ${documentName}: user ${user.id} no longer has write permission (now: ${cached})`
          );
          return;
        }
      } else {
        // 缓存未命中，查询 DB 并回填缓存
        try {
          const { access } = await verifyDocumentAccess(
            documentName,
            user.id,
            user.email
          );
          setCachedAccess(documentName, user.id, user.email, access);

          if (access !== "owner" && access !== "edit") {
            console.warn(
              `[Database] Skipping persist for ${documentName}: user ${user.id} no longer has write permission (now: ${access})`
            );
            return;
          }
        } catch (error) {
          console.error(
            `[Database] Permission check failed for ${documentName}, skipping persist:`,
            error
          );
          return;
        }
      }
    }

    try {
      // JSON content 更新降频：每 N 次 store 才转换一次 JSON（yjsState 每次都更新）
      const storeCount = (documentStoreCounts.get(documentName) ?? 0) + 1;
      documentStoreCounts.set(documentName, storeCount);
      const shouldUpdateJson = storeCount % JSON_UPDATE_INTERVAL === 0;

      // 1. 转换为 Tiptap JSON（仅在降频命中时执行，减少 CPU 开销）
      let jsonContent: string | undefined;
      if (shouldUpdateJson) {
        const ydoc = new Y.Doc();
        Y.applyUpdate(ydoc, state);
        try {
          const json = TiptapTransformer.fromYdoc(ydoc, "default");
          jsonContent = JSON.stringify(json);
        } catch (e) {
          console.warn(`[Database] Could not convert Yjs to JSON:`, e);
        }
        ydoc.destroy();
      }

      // 2. 更新数据库（大文档启用压缩）
      let stateBuffer = Buffer.from(state);
      if (state.length > COMPRESSION_THRESHOLD) {
        const compressedBuffer = gzipSync(stateBuffer);
        debugLog(
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

      debugLog(`[Database] Document ${documentName} stored successfully`);

      // 4. 更新 Redis 缓存（存原始未压缩 state，与 fetch 回填一致）
      await cacheSetBuffer(
        CACHE_KEYS.yjsState(documentName),
        Buffer.from(state),
        CACHE_TTL.yjsState
      );
      debugLog(`[Database] Redis cache updated for ${documentName}`);
    } catch (error) {
      console.error(
        `[Database] Error storing document ${documentName}:`,
        error
      );
      throw error;
    }
  },
});
