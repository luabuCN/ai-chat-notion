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

export const HIGHLIGHT_SELECTOR = `[${ATTR}]`;

function applyMarkStyles(mark: HTMLElement, color: HighlightColor) {
  mark.style.backgroundColor = HIGHLIGHT_COLORS[color].bg;
  mark.style.borderRadius = "2px";
  mark.style.padding = "0";
  mark.style.cursor = "pointer";
}

export function highlightSelection(
  color: HighlightColor = "yellow",
): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  const id = crypto.randomUUID();
  const slices = collectTextSlices(range);

  if (slices.length === 0) return null;

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

  sel.removeAllRanges();
  return id;
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
