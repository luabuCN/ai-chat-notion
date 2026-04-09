/**
 * 页面内高亮的 DOM 操作与线性文本定位（序列化/反序列化与 mark 包裹）。
 * 持久化由 highlight-db + highlight-persistence 负责。
 */
import type { StoredHighlight } from "@/lib/highlight-db";

export const HIGHLIGHT_COLORS = {
  yellow: { bg: "rgba(255, 224, 102, 0.5)", dot: "#facc15", label: "黄色" },
  green: { bg: "rgba(163, 230, 53, 0.45)", dot: "#a3e635", label: "绿色" },
  cyan: { bg: "rgba(34, 211, 238, 0.4)", dot: "#22d3ee", label: "青色" },
  blue: { bg: "rgba(96, 165, 250, 0.4)", dot: "#60a5fa", label: "蓝色" },
  purple: { bg: "rgba(192, 132, 252, 0.4)", dot: "#c084fc", label: "紫色" },
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

const ATTR = "data-wisewrite-highlight";
const ATTR_ID = "data-wisewrite-highlight-id";
const ATTR_COLOR = "data-wisewrite-highlight-color";

/** 引用片段前后各保留的字符数，用于刷新后匹配位置 */
const QUOTE_PREFIX_LEN = 32;
const QUOTE_SUFFIX_LEN = 32;

export const HIGHLIGHT_SELECTOR = `[${ATTR}]`;

function applyMarkStyles(mark: HTMLElement, color: HighlightColor) {
  mark.style.backgroundColor = HIGHLIGHT_COLORS[color].bg;
  mark.style.borderRadius = "2px";
  mark.style.padding = "0";
  mark.style.cursor = "pointer";
}

/** 收集页面内参与线性文本拼接的文本节点（与恢复时规则一致） */
function collectVisibleTextNodes(root: Node): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el) return NodeFilter.FILTER_REJECT;
      if (el.closest("script, style, noscript, textarea")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = w.nextNode())) {
    out.push(n as Text);
  }
  return out;
}

/** 将根节点下可见文本拼成一条字符串，序列化与恢复须使用相同规则 */
export function buildVisibleFullText(root: Node): string {
  return collectVisibleTextNodes(root)
    .map((node) => node.textContent ?? "")
    .join("");
}

/** 将线性文本上的 [start, end) 映射为文档 Range */
function createRangeFromLinearOffsets(start: number, end: number): Range | null {
  if (start >= end) return null;
  const nodes = collectVisibleTextNodes(document.body);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (const node of nodes) {
    const t = node.textContent ?? "";
    const len = t.length;
    if (!started && pos + len > start) {
      range.setStart(node, start - pos);
      started = true;
    }
    if (started && pos + len >= end) {
      range.setEnd(node, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}

function sortMarksByDocumentOrder(marks: HTMLElement[]): HTMLElement[] {
  return [...marks].sort((a, b) => {
    const rel = a.compareDocumentPosition(b);
    if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (rel & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

/**
 * 根据当前 DOM 中的高亮节点生成可持久化记录（含前缀/精确/后缀片段）
 */
export function serializeHighlightToRecord(
  id: string,
  pageUrl: string,
): StoredHighlight | null {
  const marks = [
    ...document.querySelectorAll<HTMLElement>(
      `[${ATTR_ID}="${CSS.escape(id)}"]`,
    ),
  ];
  if (marks.length === 0) return null;
  const first = marks[0];
  const color = first.getAttribute(ATTR_COLOR) as HighlightColor | null;
  if (!color) return null;

  const full = buildVisibleFullText(document.body);
  const ordered = sortMarksByDocumentOrder(marks);
  let searchFrom = 0;
  const segments: StoredHighlight["segments"] = [];

  for (const mark of ordered) {
    const exact = mark.textContent ?? "";
    if (exact.length === 0) continue;
    const idx = full.indexOf(exact, searchFrom);
    if (idx === -1) return null;
    const prefix = full.slice(Math.max(0, idx - QUOTE_PREFIX_LEN), idx);
    const suffix = full.slice(
      idx + exact.length,
      idx + exact.length + QUOTE_SUFFIX_LEN,
    );
    segments.push({ exact, prefix, suffix });
    searchFrom = idx + exact.length;
  }

  if (segments.length === 0) return null;

  return {
    id,
    pageUrl,
    color,
    segments,
    updatedAt: Date.now(),
  };
}

/**
 * 按持久化记录在页面中恢复高亮（不依赖选区）
 */
export function restoreHighlightRecord(record: StoredHighlight): boolean {
  const full = buildVisibleFullText(document.body);
  let searchFrom = 0;

  for (const seg of record.segments) {
    let range: Range | null = null;
    const needle = seg.prefix + seg.exact + seg.suffix;

    if (needle.length > 0) {
      const idx = full.indexOf(needle, searchFrom);
      if (idx !== -1) {
        const start = idx + seg.prefix.length;
        const end = start + seg.exact.length;
        range = createRangeFromLinearOffsets(start, end);
        if (range) searchFrom = end;
      }
    }

    if (!range) {
      const idx = full.indexOf(seg.exact, searchFrom);
      if (idx === -1) return false;
      range = createRangeFromLinearOffsets(idx, idx + seg.exact.length);
      if (!range) return false;
      searchFrom = idx + seg.exact.length;
    }

    applyHighlightToRange(range, record.id, record.color);
  }

  return true;
}

type TextSlice = { node: Text; start: number; end: number };

function collectTextSlices(range: Range): TextSlice[] {
  const result: TextSlice[] = [];

  if (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  ) {
    return [
      {
        node: range.startContainer as Text,
        start: range.startOffset,
        end: range.endOffset,
      },
    ];
  }

  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
  );

  let cur = walker.nextNode() as Text | null;
  while (cur) {
    if (range.intersectsNode(cur)) {
      const start = cur === range.startContainer ? range.startOffset : 0;
      const end =
        cur === range.endContainer
          ? range.endOffset
          : (cur.textContent?.length ?? 0);
      if (start < end) result.push({ node: cur, start, end });
    }
    cur = walker.nextNode() as Text | null;
  }

  return result;
}

/**
 * 在指定 Range 上包裹高亮；id 可与新建或恢复时一致（跨多文本节点会拆成多个 mark）
 */
export function applyHighlightToRange(
  range: Range,
  id: string,
  color: HighlightColor,
): void {
  const slices = collectTextSlices(range);

  for (const { node, start, end } of slices) {
    if (node.parentElement?.closest(HIGHLIGHT_SELECTOR)) continue;

    const text = node.textContent ?? "";
    if (start === end) continue;

    const mark = document.createElement("mark");
    mark.setAttribute(ATTR, "");
    mark.setAttribute(ATTR_ID, id);
    mark.setAttribute(ATTR_COLOR, color);
    applyMarkStyles(mark, color);

    if (start === 0 && end === text.length) {
      node.parentNode?.insertBefore(mark, node);
      mark.appendChild(node);
    } else {
      const highlightText = text.slice(start, end);
      const afterText = text.slice(end);
      const parent = node.parentNode;
      if (!parent) continue;

      node.textContent = text.slice(0, start);
      mark.textContent = highlightText;
      parent.insertBefore(mark, node.nextSibling);

      if (afterText) {
        parent.insertBefore(
          document.createTextNode(afterText),
          mark.nextSibling,
        );
      }
      if (!node.textContent) parent.removeChild(node);
    }
  }
}

/** 将当前选区包裹为高亮并生成新 id；返回 id 供持久化，失败返回 null */
export function highlightSelection(
  color: HighlightColor = "yellow",
): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  const id = crypto.randomUUID();
  applyHighlightToRange(range, id, color);
  sel.removeAllRanges();
  return id;
}

/** 更新同一 id 下所有 mark 的颜色样式与 data 属性 */
export function changeHighlightColor(
  id: string,
  newColor: HighlightColor,
): void {
  const marks = document.querySelectorAll<HTMLElement>(
    `[${ATTR_ID}="${CSS.escape(id)}"]`,
  );
  for (const mark of marks) {
    mark.setAttribute(ATTR_COLOR, newColor);
    applyMarkStyles(mark, newColor);
  }
}

/** 移除指定 id 的高亮包裹，保留纯文本 */
export function removeHighlight(id: string): void {
  const marks = document.querySelectorAll(`[${ATTR_ID}="${CSS.escape(id)}"]`);
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }
}

/** 从点击目标解析是否点在高亮 mark 上，供浮层定位使用 */
export function getHighlightInfo(
  target: EventTarget | null,
): { id: string; color: HighlightColor; element: HTMLElement } | null {
  if (!(target instanceof HTMLElement)) return null;
  const mark = target.closest(HIGHLIGHT_SELECTOR) as HTMLElement | null;
  if (!mark) return null;
  const id = mark.getAttribute(ATTR_ID);
  const color = mark.getAttribute(ATTR_COLOR) as HighlightColor | null;
  if (!id || !color) return null;
  return { id, color, element: mark };
}
