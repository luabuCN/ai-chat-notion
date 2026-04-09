/**
 * 划词高亮持久化：与 Dexie 表交互，并在适当时机调用 highlight-manager 序列化/恢复。
 */
import { highlightDb } from "@/lib/highlight-db";
import type { StoredHighlight } from "@/lib/highlight-db";
import type { HighlightColor } from "@/lib/highlight-manager";
import {
  restoreHighlightRecord,
  serializeHighlightToRecord,
} from "@/lib/highlight-manager";

/** 规范化当前页 URL（不含 hash），用于按页存取高亮 */
export function getNormalizedPageUrl(): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}`;
}

/** 将当前 DOM 中指定 id 的高亮序列化并写入数据库（新建或覆盖） */
export async function saveHighlightFromDom(id: string): Promise<void> {
  const rec = serializeHighlightToRecord(id, getNormalizedPageUrl());
  if (rec) await highlightDb.highlights.put(rec);
}

/** 仅更新数据库中的颜色字段（DOM 已由 UI 层改好） */
export async function updateHighlightColorInDb(
  id: string,
  color: HighlightColor,
): Promise<void> {
  const row = await highlightDb.highlights.get(id);
  if (row) {
    row.color = color;
    row.updatedAt = Date.now();
    await highlightDb.highlights.put(row);
  }
}

/** 从数据库删除一条高亮记录 */
export async function deleteHighlightFromDb(id: string): Promise<void> {
  await highlightDb.highlights.delete(id);
}

/** 读取当前页全部高亮记录（用于刷新后恢复） */
export async function loadHighlightsForPage(
  pageUrl: string,
): Promise<StoredHighlight[]> {
  return highlightDb.highlights.where("pageUrl").equals(pageUrl).toArray();
}

/** 按更新时间顺序恢复当前页全部高亮（单条匹配失败则该条整体跳过） */
export async function restoreAllHighlightsForCurrentPage(): Promise<void> {
  const pageUrl = getNormalizedPageUrl();
  const rows = await loadHighlightsForPage(pageUrl);
  rows.sort((a, b) => a.updatedAt - b.updatedAt);
  for (const row of rows) {
    restoreHighlightRecord(row);
  }
}
