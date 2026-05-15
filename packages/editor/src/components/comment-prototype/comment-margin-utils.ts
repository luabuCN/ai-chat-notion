import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import type { CommentMarginCueGeom } from "./comment-margin-types";

const SKIP_BLOCK_TYPES = new Set(["image", "attachment"]);

/** 表格内任意位置归一到整块 table，便于只显示一条评论入口 */
export function findCommentAnchorDepth($pos: ResolvedPos): number | null {
  if ($pos.depth < 1) {
    return null;
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!node?.type) {
      continue;
    }
    if (node.type.name === "table") {
      return depth;
    }
  }
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!node?.type) {
      continue;
    }
    if (node.type.name === "listItem") {
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

/** 由文档内任意坐标得到与边距评论按钮一致的几何（不校验「后半段」） */
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
    iconTopPx: anchor.rect.top + anchor.rect.height * 0.5 - 12,
    editorRightPx: bodyRect.right,
  };
}

export const COMMENT_MARGIN_GAP_PX = DEFAULT_MARGIN_GAP_PX;
