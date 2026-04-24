import Image from "@tiptap/extension-image";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** 自定义事件：点击预览按钮时派发，全局 ImagePreviewPortal 监听并展示预览 */
export const TIPTAP_IMAGE_PREVIEW_EVENT = "tiptap-image-preview";

export type TiptapImagePreviewDetail = { src: string };

const imageResizeVisibilityKey = new PluginKey("imageResizeVisibility");

function getImageResizeMinWidthPx(wrapper: HTMLElement): number {
  const prose = wrapper.closest(".ProseMirror");
  let containerW = 0;
  if (prose instanceof HTMLElement && prose.clientWidth > 0) {
    containerW = prose.clientWidth;
  } else if (wrapper.parentElement instanceof HTMLElement) {
    containerW = wrapper.parentElement.clientWidth;
  }
  if (containerW <= 0) {
    return 20;
  }
  return Math.max(20, Math.floor(containerW * 0.3));
}

function buildNodeView(
  node: Node,
  view: EditorView,
  getPos: () => number | undefined
) {
  const { src, alt, title, width, alignment } = node.attrs as {
    src: string;
    alt: string | null;
    title: string | null;
    width?: number | null;
    alignment?: "left" | "center" | "right";
  };

  // Alignment class mapping
  const alignmentClass = alignment === "left" ? "ml-0" : alignment === "right" ? "ml-auto" : "mx-auto";

  const wrapper = document.createElement("div");
  wrapper.className = `group relative w-fit max-w-full select-none ${alignmentClass}`;

  const img = document.createElement("img");
  img.src = src ?? "";
  img.alt = alt ?? "";
  if (title) img.title = title;
  img.className = "rounded border block max-w-full h-auto";
  img.draggable = false;
  if (width) {
    img.style.width = `${width}px`;
  }

  // Left resize handle
  const leftHandle = document.createElement("div");
  leftHandle.className =
    "image-resize-handle image-resize-handle-left opacity-0 group-hover:opacity-100 absolute top-0 bottom-0 left-0 w-5 cursor-ew-resize flex items-center justify-center z-10";
  leftHandle.innerHTML =
    '<div class="h-16 w-2 rounded-full bg-neutral-500/45 shadow-sm ring-1 ring-black/5 dark:bg-neutral-400/40 dark:ring-white/10"></div>';

  // Right resize handle
  const rightHandle = document.createElement("div");
  rightHandle.className =
    "image-resize-handle image-resize-handle-right opacity-0 group-hover:opacity-100 absolute top-0 bottom-0 right-0 w-5 cursor-ew-resize flex items-center justify-center z-10";
  rightHandle.innerHTML =
    '<div class="h-16 w-2 rounded-full bg-neutral-500/45 shadow-sm ring-1 ring-black/5 dark:bg-neutral-400/40 dark:ring-white/10"></div>';

  const overlay = document.createElement("div");
  overlay.className = "absolute right-3 top-3 opacity-60 transition-opacity group-hover:opacity-100";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = "预览";
  btn.className = "flex size-8 items-center justify-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 cursor-pointer";
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><title>预览</title><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent<TiptapImagePreviewDetail>(TIPTAP_IMAGE_PREVIEW_EVENT, {
        detail: { src: img.src },
      })
    );
  });

  overlay.appendChild(btn);
  wrapper.appendChild(leftHandle);
  wrapper.appendChild(img);
  wrapper.appendChild(rightHandle);
  wrapper.appendChild(overlay);

  // Resize logic
  let isResizing = false;
  let resizeSide: "left" | "right" = "right";
  let startX = 0;
  let startWidth = 0;

  const handleResizeStart = (e: MouseEvent, side: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    resizeSide = side;
    startX = e.clientX;
    startWidth = img.offsetWidth;
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const delta = e.clientX - startX;
    const newWidth =
      resizeSide === "right" ? startWidth + delta : startWidth - delta;
    const minW = getImageResizeMinWidthPx(wrapper);
    if (newWidth >= minW) {
      img.style.width = `${newWidth}px`;
    }
  };

  const handleResizeEnd = () => {
    if (!isResizing) return;
    isResizing = false;
    const minW = getImageResizeMinWidthPx(wrapper);
    let newWidth = img.offsetWidth;
    if (newWidth < minW) {
      newWidth = minW;
      img.style.width = `${newWidth}px`;
    }
    const pos = getPos();
    if (typeof pos === "number" && pos >= 0) {
      const tr = view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        width: newWidth,
      });
      view.dispatch(tr);
    }
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  };

  if (view.editable) {
    leftHandle.addEventListener("mousedown", (e) =>
      handleResizeStart(e, "left")
    );
    rightHandle.addEventListener("mousedown", (e) =>
      handleResizeStart(e, "right")
    );
  } else {
    leftHandle.style.display = "none";
    rightHandle.style.display = "none";
  }

  return { wrapper, img };
}

export const TiptapImage = Image.extend({
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() ?? [];
    return [
      ...parentPlugins,
      new Plugin({
        key: imageResizeVisibilityKey,
        view: (editorView) => {
          const sync = () => {
            const hide =
              !editorView.editable ||
              editorView.state.selection instanceof TextSelection;
            editorView.dom.classList.toggle("pm-hide-image-resize", hide);
          };
          sync();
          return {
            update: () => {
              sync();
            },
            destroy: () => {
              editorView.dom.classList.remove("pm-hide-image-resize");
            },
          };
        },
      }),
    ];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: "center",
        parseHTML: (element) =>
          element.style.marginLeft === "auto"
            ? "right"
            : element.style.marginLeft === "0px" || element.style.marginLeft === "0"
            ? "left"
            : "center",
        renderHTML: (attributes) => {
          if (attributes.alignment === "left") {
            return { style: "margin-left: 0" };
          }
          if (attributes.alignment === "right") {
            return { style: "margin-left: auto" };
          }
          return {};
        },
      },
    };
  },
  addNodeView() {
    return ({ node, view, getPos }) => {
      const { wrapper, img } = buildNodeView(node, view, getPos);

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;
          const attrs = updatedNode.attrs as {
            src: string;
            alt: string | null;
            title: string | null;
            width?: number | null;
            alignment?: "left" | "center" | "right";
          };
          img.src = attrs.src ?? "";
          img.alt = attrs.alt ?? "";
          img.title = attrs.title ?? "";
          if (attrs.width) {
            img.style.width = `${attrs.width}px`;
          }
          // Update alignment
          const alignmentClass = attrs.alignment === "left" ? "ml-0" : attrs.alignment === "right" ? "ml-auto" : "mx-auto";
          wrapper.className = `group relative w-fit max-w-full select-none ${alignmentClass}`;
          return true;
        },
      };
    };
  },
}).configure({
  allowBase64: false,
});
