/**
 * 气泡选区父级在 `tiptap-editor.css` / `block-editor.scss` 中为 `z-index: 99999`（`.bubbleMenu-floating`）。
 * Portaled 的 Popover 默认 `z-50`，会叠在横条下；`bubble-menu-portal-popover-elevate` 在样式中定义为 100000。
 */
export const BUBBLE_MENU_PORTAL_POPOVER_Z_CLASS = "bubble-menu-portal-popover-elevate";
