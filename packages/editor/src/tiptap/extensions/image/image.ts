import Image from "@tiptap/extension-image";
import type { Node } from "@tiptap/pm/model";

/** 自定义事件：点击预览按钮时派发，全局 ImagePreviewPortal 监听并展示预览 */
export const TIPTAP_IMAGE_PREVIEW_EVENT = "tiptap-image-preview";

export type TiptapImagePreviewDetail = { src: string };

function buildNodeView(node: Node) {
  const { src, alt, title } = node.attrs as {
    src: string;
    alt: string | null;
    title: string | null;
  };

  const wrapper = document.createElement("div");
  wrapper.className = "group relative w-fit max-w-full mx-auto";

  const img = document.createElement("img");
  img.src = src ?? "";
  img.alt = alt ?? "";
  if (title) img.title = title;
  img.className = "rounded border block max-w-full h-auto";
  img.draggable = false;

  const overlay = document.createElement("div");
  overlay.className =
    "absolute right-3 top-3 opacity-60 transition-opacity group-hover:opacity-100";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = "预览";
  btn.className =
    "flex size-8 items-center justify-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 cursor-pointer";
  btn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><title>预览</title><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';

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
  wrapper.appendChild(img);
  wrapper.appendChild(overlay);

  return { wrapper, img, btn };
}

export const TiptapImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const { wrapper, img } = buildNodeView(node);

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;
          const attrs = updatedNode.attrs as {
            src: string;
            alt: string | null;
            title: string | null;
          };
          img.src = attrs.src ?? "";
          img.alt = attrs.alt ?? "";
          img.title = attrs.title ?? "";
          return true;
        },
      };
    };
  },
}).configure({
  allowBase64: false,
});
