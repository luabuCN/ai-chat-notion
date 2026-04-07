import { cn } from "@repo/ui";
import { ChevronLeft, Pin, X } from "lucide-react";
import { type ReactNode, useCallback, useRef, useState } from "react";
import Draggable from "react-draggable";

export type FloatingPanelProps = {
  /** 标题（展示在头部左侧） */
  title: string;
  /** 关闭 */
  onClose: () => void;
  /** 可选：显示返回箭头 */
  onBack?: () => void;
  /** 主体 */
  children: ReactNode;
  /** 底部栏（如输入区、操作条） */
  footer?: ReactNode;
  /** 初始宽度（px） */
  defaultWidth?: number;
  /** 初始高度（px） */
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  /** 初始是否固定（不可拖拽） */
  defaultPinned?: boolean;
  /** 受控：固定状态变化 */
  onPinnedChange?: (pinned: boolean) => void;
  /** 点击遮罩是否关闭（默认 true） */
  closeOnBackdrop?: boolean;
  /** 根节点 className */
  className?: string;
  /** 内容区 className */
  bodyClassName?: string;
};

/**
 * 可复用浮动层：头部拖拽、图钉固定、右下角/边 CSS 拉伸。
 * 用于扩展内弹窗、结果面板等，与视口内居中定位。
 */
export function FloatingPanel({
  title,
  onClose,
  onBack,
  children,
  footer,
  defaultWidth = 480,
  defaultHeight = 520,
  minWidth = 300,
  minHeight = 220,
  defaultPinned = false,
  onPinnedChange,
  closeOnBackdrop = true,
  className,
  bodyClassName,
}: FloatingPanelProps) {
  const [pinned, setPinned] = useState(defaultPinned);
  const panelRef = useRef<HTMLDivElement>(null);

  const togglePinned = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      onPinnedChange?.(next);
      return next;
    });
  }, [onPinnedChange]);

  const backdropMouseDown = useCallback(() => {
    if (closeOnBackdrop) onClose();
  }, [closeOnBackdrop, onClose]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-auto fixed inset-0 z-2147483647 bg-black/20"
        onMouseDown={backdropMouseDown}
      />

      <div className="pointer-events-none fixed inset-0 z-2147483647 flex items-center justify-center">
        {/* 水平居中；上下留白避免贴边；轻微上移 ≈ 常见 AI 对话窗（勿用过大 translate，否则会顶到视口上沿） */}
        <div className="pointer-events-none box-border flex h-full w-full min-h-0 items-center justify-center px-4 py-8 sm:py-10 -translate-y-[min(2.5rem,5vh)]">
          <Draggable
            bounds="parent"
            defaultClassNameDragging="!cursor-grabbing"
            disabled={pinned}
            enableUserSelectHack={false}
            handle=".floating-panel-drag-handle"
            nodeRef={panelRef}
          >
            <div
              ref={panelRef}
              className={cn(
                "pointer-events-auto flex max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl will-change-transform",
                "resize",
                className,
              )}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                height: defaultHeight,
                minHeight,
                minWidth,
                width: defaultWidth,
              }}
            >
              <header className="floating-panel-drag-handle flex shrink-0 cursor-grab select-none items-center gap-2 border-b border-slate-200/80 px-3 py-2.5 active:cursor-grabbing">
                {onBack ? (
                  <button
                    aria-label="返回"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBack();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    type="button"
                  >
                    <ChevronLeft className="size-5" strokeWidth={2} />
                  </button>
                ) : null}
                <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-slate-900">
                  {title}
                </h2>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    aria-label={pinned ? "取消固定" : "固定窗口"}
                    aria-pressed={pinned}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
                      pinned && "bg-primary/10 text-primary",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePinned();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    type="button"
                  >
                    <Pin className="size-4" strokeWidth={2} />
                  </button>
                  <button
                    aria-label="关闭"
                    className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    type="button"
                  >
                    <X className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </header>

              <div
                className={cn(
                  "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-2",
                  bodyClassName,
                )}
              >
                {children}
              </div>

              {footer ? (
                <div className="shrink-0 border-t border-slate-200/80">{footer}</div>
              ) : null}
            </div>
          </Draggable>
        </div>
      </div>
    </>
  );
}
