"use client";

import { useEffect } from "react";

/** 与 `EditorContent` 内监听器对应，用于 Cmd/Ctrl+S 立即保存 */
export const EDITOR_PAGE_REQUEST_SAVE = "editor-page:request-save";

export interface UseEditorPageShortcutsOptions {
  /** 文档已加载且可进入编辑区时为 true */
  enabled: boolean;
}

/**
 * 编辑器页全局快捷键（捕获阶段）。
 * 撤销/重做/粘贴/Space 打开 AI 等由 `@repo/editor` 内 Tiptap 与 AI 面板处理；
 * 此处仅统一拦截 **Cmd/Ctrl+S**，避免浏览器「另存网页」并触发正文保存流程。
 */
export function useEditorPageShortcuts({
  enabled,
}: UseEditorPageShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key !== "s" || event.repeat) {
        return;
      }
      event.preventDefault();
      window.dispatchEvent(new CustomEvent(EDITOR_PAGE_REQUEST_SAVE));
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled]);
}
