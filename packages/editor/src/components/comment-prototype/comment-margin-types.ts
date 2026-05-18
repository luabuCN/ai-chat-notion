export type CommentMarginCueGeom = {
  anchorPos: number;
  /**
   * 与 anchorPos 对应的块的稳定 id（由 `@tiptap/extension-unique-id` 写入）。
   * 评论数据按 blockId 入库；位置仅用于绘制图标 / 面板。
   * 极少数情况（如 SKIP_BLOCK_TYPES 之外但暂无 id 的旧块）允许为 null，
   * 此时仅可展示 hover UI，但禁止落地评论。
   */
  blockId: string | null;
  iconTopPx: number;
  iconLeftPx: number;
  /** 正文区域右边界，用于与图标之间的透明命中桥 */
  editorRightPx: number;
};
