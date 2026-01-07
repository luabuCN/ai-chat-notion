/**
 * 数据迁移脚本：将现有文档的 JSON 内容转换为 Yjs 格式
 *
 * 运行方式：
 * pnpm migrate:yjs
 *
 * 可选参数：
 * --dry-run    只检查不实际写入
 * --batch=100  每批处理的文档数量
 * --id=xxx     只迁移指定 ID 的文档
 */

import { PrismaClient } from "@prisma/client";
import * as Y from "yjs";

// 直接创建 Prisma 客户端，避免导入 @repo/database 的 server-only 依赖
const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * 将 Tiptap JSON 内容转换为 Yjs XmlFragment
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
        const markObj = mark as Record<string, unknown>;
        attrs[markObj.type as string] = "true";
        // 处理带属性的 marks（如 link）
        if (markObj.attrs && typeof markObj.attrs === "object") {
          for (const [key, value] of Object.entries(
            markObj.attrs as Record<string, unknown>
          )) {
            if (value !== null && value !== undefined) {
              attrs[`${markObj.type}_${key}`] = String(value);
            }
          }
        }
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
        element.setAttribute(key, String(value));
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
 * 将 JSON 内容转换为 Yjs 二进制状态
 */
function convertJsonToYjsState(jsonContent: string): Uint8Array | null {
  try {
    const json = JSON.parse(jsonContent);
    const ydoc = new Y.Doc();
    const fragment = ydoc.getXmlFragment("default");
    jsonToYXmlFragment(json, fragment);
    const state = Y.encodeStateAsUpdate(ydoc);
    ydoc.destroy();
    return state;
  } catch (error) {
    console.error("Failed to convert JSON to Yjs:", error);
    return null;
  }
}

/**
 * 迁移单个文档
 */
async function migrateDocument(
  id: string,
  content: string | null,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!content || content.trim() === "" || content === "null") {
    return { success: true }; // 跳过空文档
  }

  const yjsState = convertJsonToYjsState(content);
  if (!yjsState) {
    return { success: false, error: "Failed to convert JSON to Yjs format" };
  }

  if (dryRun) {
    console.log(
      `  [DRY-RUN] Would migrate document ${id} (${yjsState.length} bytes)`
    );
    return { success: true };
  }

  try {
    await prisma.editorDocument.update({
      where: { id },
      data: { yjsState: Buffer.from(yjsState) },
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 主迁移函数
 */
async function migrate(options: {
  dryRun: boolean;
  batchSize: number;
  specificId?: string;
}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log("🚀 Starting migration...");
  console.log(`   Mode: ${options.dryRun ? "DRY-RUN" : "LIVE"}`);
  console.log(`   Batch size: ${options.batchSize}`);

  // 查询条件
  const where: any = {
    yjsState: null, // 只迁移还没有 yjsState 的文档
    content: { not: null }, // 只迁移有内容的文档
  };

  if (options.specificId) {
    where.id = options.specificId;
  }

  // 获取需要迁移的文档总数
  const totalCount = await prisma.editorDocument.count({ where });
  stats.total = totalCount;
  console.log(`📊 Found ${totalCount} documents to migrate`);

  if (totalCount === 0) {
    console.log("✅ No documents need migration");
    return stats;
  }

  // 分批处理
  let skip = 0;
  let processed = 0;

  while (processed < totalCount) {
    const documents = await prisma.editorDocument.findMany({
      where,
      select: {
        id: true,
        title: true,
        content: true,
      },
      take: options.batchSize,
      skip,
      orderBy: { createdAt: "asc" },
    });

    if (documents.length === 0) {
      break;
    }

    console.log(
      `\n📦 Processing batch ${Math.floor(skip / options.batchSize) + 1} (${
        documents.length
      } documents)`
    );

    for (const doc of documents) {
      process.stdout.write(`  Migrating "${doc.title}" (${doc.id})... `);

      if (!doc.content) {
        console.log("SKIPPED (empty)");
        stats.skipped++;
        continue;
      }

      const result = await migrateDocument(doc.id, doc.content, options.dryRun);

      if (result.success) {
        if (!options.dryRun) {
          console.log("OK");
        }
        stats.migrated++;
      } else {
        console.log(`FAILED: ${result.error}`);
        stats.failed++;
        stats.errors.push({
          id: doc.id,
          error: result.error || "Unknown error",
        });
      }

      processed++;
    }

    skip += options.batchSize;
  }

  return stats;
}

/**
 * 打印迁移统计
 */
function printStats(stats: MigrationStats): void {
  console.log("\n" + "=".repeat(50));
  console.log("📊 Migration Statistics");
  console.log("=".repeat(50));
  console.log(`Total documents:    ${stats.total}`);
  console.log(`Successfully migrated: ${stats.migrated}`);
  console.log(`Skipped (empty):    ${stats.skipped}`);
  console.log(`Failed:             ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log("\n❌ Failed documents:");
    for (const { id, error } of stats.errors) {
      console.log(`  - ${id}: ${error}`);
    }
  }

  console.log("=".repeat(50));
}

/**
 * 解析命令行参数
 */
function parseArgs(): {
  dryRun: boolean;
  batchSize: number;
  specificId?: string;
} {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    batchSize: 100,
    specificId: undefined as string | undefined,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--batch=")) {
      options.batchSize = Number.parseInt(arg.split("=")[1], 10);
    } else if (arg.startsWith("--id=")) {
      options.specificId = arg.split("=")[1];
    }
  }

  return options;
}

// 主入口
async function main() {
  const options = parseArgs();

  try {
    const stats = await migrate(options);
    printStats(stats);

    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
