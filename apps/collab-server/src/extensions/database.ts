import { Database } from "@hocuspocus/extension-database";
import { PrismaClient } from "@prisma/client";
import * as Y from "yjs";

// 直接创建 Prisma 客户端，避免导入 @repo/database 的 server-only 依赖
const prisma = new PrismaClient();

/**
 * 将 Tiptap JSON 内容转换为 Yjs XmlFragment
 * 用于初始化没有 yjsState 的文档
 */
function jsonToYXmlFragment(
  json: Record<string, unknown>,
  xmlFragment: Y.XmlFragment
): void {
  if (json.type === "doc" && Array.isArray(json.content)) {
    for (const node of json.content) {
      const element = jsonNodeToYXmlElement(node as Record<string, unknown>);
      if (element) {
        xmlFragment.push([element]);
      }
    }
  }
}

/**
 * 将单个 JSON 节点转换为 Yjs XmlElement
 */
function jsonNodeToYXmlElement(
  node: Record<string, unknown>
): Y.XmlElement | Y.XmlText | null {
  if (!node || typeof node !== "object") {
    return null;
  }

  const type = node.type as string;
  if (!type) {
    return null;
  }

  // 文本节点
  if (type === "text") {
    const text = new Y.XmlText();
    text.insert(0, (node.text as string) || "");
    // 处理 marks (如 bold, italic 等)
    if (Array.isArray(node.marks)) {
      const attrs: Record<string, string> = {};
      for (const mark of node.marks) {
        attrs[(mark as Record<string, unknown>).type as string] = "true";
      }
      text.format(0, text.length, attrs);
    }
    return text;
  }

  // 元素节点
  const element = new Y.XmlElement(type);

  // 设置属性
  if (node.attrs && typeof node.attrs === "object") {
    for (const [key, value] of Object.entries(
      node.attrs as Record<string, unknown>
    )) {
      if (value !== null && value !== undefined) {
        // 跳过 null 值的 colwidth（表格列宽）
        if (key === "colwidth" && value === null) {
          continue;
        }
        // 数组类型（如 colwidth）需要特殊处理
        if (Array.isArray(value)) {
          // 将数组序列化为 JSON 字符串
          element.setAttribute(key, JSON.stringify(value));
        } else if (typeof value === "number" || typeof value === "boolean") {
          // 保持数值和布尔类型
          element.setAttribute(key, value as unknown as string);
        } else {
          element.setAttribute(key, String(value));
        }
      }
    }
  }

  // 处理子节点
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const childElement = jsonNodeToYXmlElement(
        child as Record<string, unknown>
      );
      if (childElement) {
        element.push([childElement]);
      }
    }
  }

  return element;
}

/**
 * 从 Yjs XmlFragment 提取纯文本（用于搜索等功能）
 */
function extractTextFromYDoc(doc: Y.Doc): string {
  const fragment = doc.getXmlFragment("default");
  return extractTextFromFragment(fragment);
}

function extractTextFromFragment(
  fragment: Y.XmlFragment | Y.XmlElement
): string {
  let text = "";
  for (const child of fragment.toArray()) {
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      text += extractTextFromFragment(child);
      // 块级元素后添加换行
      const blockElements = [
        "paragraph",
        "heading",
        "blockquote",
        "codeBlock",
        "listItem",
      ];
      if (blockElements.includes(child.nodeName)) {
        text += "\n";
      }
    }
  }
  return text;
}

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

      // 如果有 Yjs 状态，尝试使用它
      if (doc.yjsState && doc.yjsState.length > 0) {
        console.log(
          `[Database] Found existing Yjs state for ${documentName}, size: ${doc.yjsState.length} bytes`
        );

        // 验证 Yjs 状态是否有实际内容
        try {
          const tempDoc = new Y.Doc();
          Y.applyUpdate(tempDoc, doc.yjsState);
          const fragment = tempDoc.getXmlFragment("default");
          const hasContent = fragment.length > 0;
          console.log(`[Database] Yjs fragment has ${fragment.length} items`);
          tempDoc.destroy();

          if (hasContent) {
            return Buffer.from(doc.yjsState);
          } else {
            console.log(
              `[Database] Yjs state is empty, will try to convert from content`
            );
          }
        } catch (e) {
          console.error(`[Database] Failed to validate Yjs state:`, e);
        }
      }

      // 如果没有 Yjs 状态但有 JSON 内容，尝试转换
      if (doc.content) {
        console.log(
          `[Database] Converting JSON content to Yjs for ${documentName}`
        );
        console.log(`[Database] Content length: ${doc.content.length}`);
        console.log(
          `[Database] Content preview: ${doc.content.substring(0, 200)}...`
        );
        try {
          const jsonContent = JSON.parse(doc.content);
          console.log(
            `[Database] Parsed JSON type: ${jsonContent.type}, content items: ${
              jsonContent.content?.length || 0
            }`
          );
          const ydoc = new Y.Doc();
          const fragment = ydoc.getXmlFragment("default");
          jsonToYXmlFragment(jsonContent, fragment);
          console.log(
            `[Database] Fragment length after conversion: ${fragment.length}`
          );
          const state = Y.encodeStateAsUpdate(ydoc);
          console.log(`[Database] Yjs state size: ${state.length} bytes`);
          ydoc.destroy();
          return Buffer.from(state);
        } catch (parseError) {
          console.error(
            `[Database] Failed to parse content for ${documentName}:`,
            parseError
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
      // 从 Yjs 状态中提取文本内容（用于搜索和预览）
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, state);

      // 提取纯文本用于搜索
      const textContent = extractTextFromYDoc(ydoc);

      // 将 Yjs 状态转换为 Tiptap JSON 格式（保持兼容性）
      let jsonContent: string | undefined;
      try {
        const fragment = ydoc.getXmlFragment("default");
        // 这里简化处理，实际可能需要更复杂的转换逻辑
        jsonContent = JSON.stringify({
          type: "doc",
          content: fragment.toJSON(),
        });
      } catch (e) {
        console.warn(`[Database] Could not convert Yjs to JSON:`, e);
      }

      ydoc.destroy();

      // 更新数据库
      await prisma.editorDocument.update({
        where: { id: documentName },
        data: {
          yjsState: Buffer.from(state),
          // 保持 content 字段同步（用于非协同场景的兼容）
          ...(jsonContent && { content: jsonContent }),
          // 更新编辑者信息（如果有）
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
