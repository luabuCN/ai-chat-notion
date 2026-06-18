"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui";
import { ExternalLink } from "lucide-react";
import {
  EDITOR_LINK_CONFIRM_EVENT,
  type LinkConfirmDetail,
} from "../lib/link-click-handler";

/**
 * 监听编辑器超链接点击事件，用 AlertDialog 替代原生 confirm。
 *
 * 需要在编辑器组件内挂载一次（tiptap-editor / unified-editor）。
 */
export function LinkConfirmDialog() {
  const [pending, setPending] = useState<LinkConfirmDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<LinkConfirmDetail>).detail;
      setPending(detail);
    };
    window.addEventListener(EDITOR_LINK_CONFIRM_EVENT, handler);
    return () => window.removeEventListener(EDITOR_LINK_CONFIRM_EVENT, handler);
  }, []);

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-[min(100vw-2rem,380px)] p-6 gap-5">
        <div className="flex items-start gap-4">
          {/* 图标 */}
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
            <ExternalLink className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          {/* 文字区域 */}
          <AlertDialogHeader className="flex-1 space-y-1.5 text-left p-0">
            <AlertDialogTitle className="text-base font-semibold tracking-normal">
              即将离开当前页面
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              确认后将在新标签页中打开以下链接：
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        {/* URL 展示 */}
        <div className="rounded-lg border bg-muted/50 px-3 py-2.5">
          <p className="text-xs font-mono leading-relaxed text-muted-foreground break-all">
            {pending?.href}
          </p>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel
            onClick={handleCancel}
            className="h-9 rounded-lg text-sm font-medium"
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="h-9 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            确认跳转
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
