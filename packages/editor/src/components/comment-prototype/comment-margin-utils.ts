import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import scrollIntoView from "scroll-into-view-if-needed";
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

/** 块内无可见文字时不展示 hover 评论入口（已有评论的块仍由持久图标负责）。 */
export function isEmptyCommentAnchorNode(node: ProseMirrorNode): boolean {
  if (SKIP_BLOCK_TYPES.has(node.type.name)) {
    return true;
  }
  if (node.type.name === "table") {
    return false;
  }
  return node.textContent.trim().length === 0;
}

export function getCommentAnchorFromPos(
  view: EditorView,
  pos: number
): {
  anchorPos: number;
  blockId: string | null;
  isEmpty: boolean;
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

  const rawId = (anchorNode.attrs as { id?: unknown } | undefined)?.id;
  const blockId = typeof rawId === "string" && rawId.length > 0 ? rawId : null;

  return {
    anchorPos,
    blockId,
    isEmpty: isEmptyCommentAnchorNode(anchorNode),
    rect: element.getBoundingClientRect(),
  };
}

/**
 * 「后半段」：指针在块水平方向约 66% 以右，且纵向与块相交（略放宽容差）。
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

  return clientX >= blockRect.left + blockRect.width * 0.66;
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
    blockId: anchor.blockId,
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
  let blockId: string | null = null;
  try {
    const node = doc.nodeAt(anchorPos);
    const rawId = node?.attrs?.id;
    if (typeof rawId === "string" && rawId.length > 0) {
      blockId = rawId;
    }
  } catch {
    blockId = null;
  }
  const rect = element.getBoundingClientRect();
  const bodyRect = view.dom.getBoundingClientRect();
  return {
    anchorPos,
    blockId,
    editorRightPx: bodyRect.right,
    iconLeftPx: bodyRect.right + gapPx,
    iconTopPx: rect.top,
  };
}

/** 在文档中按 block attrs.id 查找 ProseMirror 位置。 */
function findBlockPosById(view: EditorView, blockId: string): number {
  if (!blockId) {
    return -1;
  }
  const { doc } = view.state;
  let foundPos = -1;
  doc.descendants((node, pos) => {
    if (foundPos !== -1) {
      return false;
    }
    if (SKIP_BLOCK_TYPES.has(node.type.name)) {
      return false;
    }
    const rawId = node.attrs?.id;
    if (typeof rawId === "string" && rawId === blockId) {
      foundPos = pos;
      return false;
    }
    return true;
  });
  return foundPos;
}

/**
 * 通知跳转等场景：仅在目标块不可见时滚动，且限定在 `#editor-scroll-container` 内。
 * 避免 `scrollIntoView({ block: "center" })` 在已在当前文档时把页面强行往下推。
 */
export function scrollBlockIntoViewIfNeeded(
  view: EditorView,
  blockId: string
): void {
  const foundPos = findBlockPosById(view, blockId);
  if (foundPos < 0) {
    return;
  }
  const element = view.nodeDOM(foundPos);
  if (!(element instanceof HTMLElement)) {
    return;
  }
  const boundary = document.getElementById("editor-scroll-container");
  scrollIntoView(element, {
    scrollMode: "if-needed",
    block: "nearest",
    behavior: "smooth",
    ...(boundary ? { boundary } : {}),
  });
}

/**
 * 按 stable blockId 查找节点并构造图标几何。
 *
 * 持久图标依赖此函数：评论以 blockId 为 key 持久化，渲染时再回到当前文档查找。
 * 命中策略与 `findCommentAnchorDepth` 对齐：跳过表格单元格等中间结构，仅对
 * 顶层 textblock / 整个 table 命中（哪个匹配先返回哪个）。
 */
export function buildMarginCueGeomForBlockId(
  view: EditorView,
  blockId: string,
  gapPx = DEFAULT_MARGIN_GAP_PX
): CommentMarginCueGeom | null {
  const foundPos = findBlockPosById(view, blockId);
  if (foundPos < 0) {
    return null;
  }
  const element = view.nodeDOM(foundPos);
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  const bodyRect = view.dom.getBoundingClientRect();
  return {
    anchorPos: foundPos,
    blockId,
    editorRightPx: bodyRect.right,
    iconLeftPx: bodyRect.right + gapPx,
    iconTopPx: rect.top,
  };
}

export const COMMENT_MARGIN_GAP_PX = DEFAULT_MARGIN_GAP_PX;
