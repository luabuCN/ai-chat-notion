import Dexie, { type Table } from "dexie";
import type { HighlightColor } from "@/lib/highlight-manager";

/** 单段高亮在整页线性文本中的定位（前缀 + 精确文本 + 后缀，用于刷新后匹配） */
export type HighlightSegment = {
  /** 被高亮的精确文本 */
  exact: string;
  /** 精确片段之前的若干字符 */
  prefix: string;
  /** 精确片段之后的若干字符 */
  suffix: string;
};

/** 一条可持久化的高亮（一次划词可能拆成多段 DOM，故 segments 为数组） */
export type StoredHighlight = {
  /** 高亮唯一 id，与 DOM 上 data 属性一致 */
  id: string;
  /** 规范化后的页面 URL（不含 hash），用于按页查询 */
  pageUrl: string;
  /** 高亮颜色键名 */
  color: HighlightColor;
  /** 按文档顺序排列的文本片段 */
  segments: HighlightSegment[];
  /** 最后更新时间戳（毫秒） */
  updatedAt: number;
};

/**
 * 划词高亮本地数据库（IndexedDB，通过 Dexie 封装）
 * - 库名：wisewrite-highlight
 * - 表 highlights：主键 id，索引 pageUrl、updatedAt
 */
export class HighlightDexie extends Dexie {
  /** 高亮记录表 */
  highlights!: Table<StoredHighlight, string>;

  constructor() {
    super("wisewrite-highlight");
    this.version(1).stores({
      highlights: "id, pageUrl, updatedAt",
    });
  }
}

/** 全扩展共用的 Dexie 实例，避免重复打开连接 */
export const highlightDb = new HighlightDexie();
