"use client";

import { Skeleton, cn } from "@repo/ui";

/**
 * 极简骨架：顶栏色块 + 图标与标题条左对齐（与 max-w-4xl 正文列一致）
 */
export function EditorLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-h-full w-full flex-col bg-background", className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">正在加载编辑器</span>

      {/* 顶部占位：约 1/3 视高，浅灰全宽 */}
      <div
        className="h-[min(34vh,280px)] min-h-[160px] w-full shrink-0 bg-muted/80 dark:bg-muted/50"
        aria-hidden
      />

      {/* 与正文同宽、左对齐 */}
      <div className="relative z-1 w-full flex-1 px-4 pb-16 pt-0">
        <div className="mx-auto max-w-4xl">
          <div className="-mt-8 flex flex-col items-start">
            <Skeleton className="size-14 rounded-2xl shadow-sm ring-4 ring-background" />
            <Skeleton className="mt-6 h-3.5 w-[min(14rem,72vw)] max-w-sm rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 正文区域骨架：与 max-w-4xl 正文列同宽，用于预览页等场景在编辑器分包加载时占位
 */
export function EditorBodyLoadingSkeleton() {
  return (
    <div
      className="w-full space-y-3 pt-1"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">正在加载正文</span>
      <Skeleton className="h-4 w-full max-w-2xl rounded-md" aria-hidden />
      <Skeleton className="h-4 w-full rounded-md" aria-hidden />
      <Skeleton className="h-4 w-[92%] rounded-md" aria-hidden />
      <Skeleton className="h-4 w-full rounded-md" aria-hidden />
      <Skeleton className="h-4 w-[78%] rounded-md" aria-hidden />
      <Skeleton className="h-4 w-full rounded-md" aria-hidden />
      <Skeleton className="h-4 w-[88%] rounded-md" aria-hidden />
    </div>
  );
}
