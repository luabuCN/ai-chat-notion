import type { EditorView } from "@tiptap/pm/view";

/** 自定义事件名称：编辑器超链接点击请求确认 */
export const EDITOR_LINK_CONFIRM_EVENT = "editor:link:confirm";

/** 事件 detail 类型 */
export interface LinkConfirmDetail {
  href: string;
  /** 由 LinkConfirmDialog 组件调用，true = 确认跳转 */
  resolve: (confirmed: boolean) => void;
}

/**
 * 编辑器中超链接点击拦截（ProseMirror handleClick 回调）。
 *
 * 不直接弹窗，而是派发 `editor:link:confirm` 自定义事件，
 * 由 React 侧的 `<LinkConfirmDialog>` 监听并渲染 AlertDialog。
 */
export function handleLinkClick(
  _view: EditorView,
  _pos: number,
  event: MouseEvent
): boolean {
  const target = event.target as HTMLElement;
  const anchor = target.closest("a");

  if (!anchor) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  event.preventDefault();
  event.stopPropagation();

  const detail: LinkConfirmDetail = {
    href,
    resolve: (confirmed: boolean) => {
      if (confirmed) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
  };

  window.dispatchEvent(
    new CustomEvent<LinkConfirmDetail>(EDITOR_LINK_CONFIRM_EVENT, { detail })
  );

  return true;
}
