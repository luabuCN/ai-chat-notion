import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type { CommentMarginCueGeom } from "./comment-margin-types";

const SKIP_BLOCK_TYPES = new Set(["image", "attachment", "youtube"]);

/**
 * 「每段一行」的评论锚点策略：
 * - 表格内任意位置 → 归一到整块 table（避免单元格里全都点出图标）
 * - 其它情况 → 最深的 textblock（paragraph / heading / codeBlock / blockquote 内段落 / 列表项内段落…）
 */
export function findCommentAnchorDepth($pos: ResolvedPos): number | null {
  if ($pos.depth < 1) {
    return null;
  }

  for (let depth = 1; depth <= $pos.depth; depth += 1) {
    const node = $pos.node(depth);
    if (node?.type?.name === "table") {
      return depth;
    }
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (node?.type?.isTextblock) {
      return depth;
    }
  }

  return 1;
}

export function getCommentAnchorFromPos(
  view: EditorView,
  pos: number
): {
  anchorPos: number;
  rect: DOMRect | null;
} | null {
  const { doc } = view.state;
  const maxPos = doc.content.size;
  const safePos = Math.max(0, Math.min(pos, maxPos));
  let $pos: ResolvedPos;
  try {
    $pos = doc.resolve(safePos);
  } catch {
    return null;
  }

  const depth = findCommentAnchorDepth($pos);
  if (depth === null || depth > $pos.depth) {
    return null;
  }

  const anchorNode = $pos.node(depth);
  if (!anchorNode?.type) {
    return null;
  }

  const anchorPos = $pos.before(depth);

  if (SKIP_BLOCK_TYPES.has(anchorNode.type.name)) {
    return null;
  }

  const element = view.nodeDOM(anchorPos);
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  return { anchorPos, rect: element.getBoundingClientRect() };
}

/**
 * 「后半段」：指针在块水平方向约 42% 以右，且纵向与块相交（略放宽容差）。
 */
export function shouldShowTrailingCommentCue(
  clientX: number,
  clientY: number,
  blockRect: DOMRect
): boolean {
  const inVerticalBlock =
    clientY >= blockRect.top - 6 && clientY <= blockRect.bottom + 6;

  if (!inVerticalBlock) {
    return false;
  }

  return clientX >= blockRect.left + blockRect.width * 0.42;
}

const DEFAULT_MARGIN_GAP_PX = 8;

/** 由文档内任意坐标得到与边距评论按钮一致的几何（不校验「后半段」）；图标 `top` 与块顶对齐 */
export function buildMarginCueGeomForPos(
  view: EditorView,
  pos: number,
  gapPx = DEFAULT_MARGIN_GAP_PX
): CommentMarginCueGeom | null {
  const anchor = getCommentAnchorFromPos(view, pos);
  if (!anchor?.rect) {
    return null;
  }
  const bodyRect = view.dom.getBoundingClientRect();
  return {
    anchorPos: anchor.anchorPos,
    iconLeftPx: bodyRect.right + gapPx,
    iconTopPx: anchor.rect.top,
    editorRightPx: bodyRect.right,
  };
}

/**
 * 已经归一过的 anchorPos（block 起始 token 之前的位置）直接取 DOM 重算几何。
 *
 * 不能复用 `buildMarginCueGeomForPos`：把 anchorPos 再走一次 `doc.resolve` 时
 * `$pos.depth === 0`，`findCommentAnchorDepth` 直接判 null，导致持久图标位置无法刷新。
 * 图标 `top` 与块顶对齐（与 `buildMarginCueGeomForPos` 一致）。
 */
export function buildMarginCueGeomForAnchorPos(
  view: EditorView,
  anchorPos: number,
  gapPx = DEFAULT_MARGIN_GAP_PX
): CommentMarginCueGeom | null {
  const { doc } = view.state;
  if (anchorPos < 0 || anchorPos > doc.content.size) {
    return null;
  }
  const element = view.nodeDOM(anchorPos);
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const bodyRect = view.dom.getBoundingClientRect();
  return {
    anchorPos,
    editorRightPx: bodyRect.right,
    iconLeftPx: bodyRect.right + gapPx,
    iconTopPx: rect.top,
  };
}

export const COMMENT_MARGIN_GAP_PX = DEFAULT_MARGIN_GAP_PX;
