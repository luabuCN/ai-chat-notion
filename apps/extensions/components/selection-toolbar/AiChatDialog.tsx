import { Avatar, AvatarFallback, Button } from "@repo/ui";
import { Send, Brain, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Draggable from "react-draggable";
import TextareaAutosize from "react-textarea-autosize";

type AiChatDialogProps = {
  /** 用户选中的文本 */
  selectedText: string;
  /** 关闭对话窗 */
  onClose: () => void;
};

export function AiChatDialog({ selectedText, onClose }: AiChatDialogProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 打开时自动聚焦输入框
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Escape 关闭
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    // TODO: 实际发送 AI 对话请求
    // biome-ignore lint/suspicious/noConsole: 临时调试
    console.log("[AiChatDialog] send:", { selectedText, input });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!input.trim()) return;
    // biome-ignore lint/suspicious/noConsole: 临时调试
    console.log("[AiChatDialog] send:", { selectedText, input });
  };

  return (
    <>
      {/* 透明遮罩层：点击此处关闭对话窗 */}
      <div
        className="pointer-events-auto fixed inset-0 z-2147483647"
        onMouseDown={onClose}
      />

      <div className="pointer-events-none fixed inset-0 z-2147483647 flex items-center justify-center">
        {/* 铺满视口作为拖拽 bounds 的父级；整体上移约 1/4 视口高度 */}
        <div className="pointer-events-none flex h-full w-full min-h-0 items-center justify-center -translate-y-[25vh]">
          <Draggable
            bounds="parent"
            defaultClassNameDragging="!cursor-grabbing"
            enableUserSelectHack={false}
            handle=".drag-handle"
            nodeRef={panelRef}
          >
            {/* 仅外层接收拖拽 transform，内层做入场动画，避免 transform 冲突导致拖拽滞后 */}
            <div
              ref={panelRef}
              className="pointer-events-auto w-[520px] max-w-[calc(100vw-32px)] will-change-transform"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-slate-200/60 bg-slate-50 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                {/* 选中文字展示区 (拖拽手柄区域) */}
                <div className="drag-handle cursor-grab px-2 pt-2 pb-1 select-none active:cursor-grabbing">
                  <div className="flex w-full items-center gap-3 rounded-lg bg-slate-200/60 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-slate-500 select-none">
                      {selectedText}
                    </span>
                    <button
                      aria-label="关闭"
                      className="shrink-0 rounded-full bg-slate-400 p-[3px] text-white hover:bg-slate-500 transition-colors cursor-pointer"
                      onClick={onClose}
                      onMouseDown={(e) => e.stopPropagation()}
                      type="button"
                    >
                      <X className="size-2.5" strokeWidth={3} />
                    </button>
                  </div>
                </div>

                {/* 输入区 - 自动换行无边框 */}
                <form
                  className="flex items-end gap-2 px-3 pb-2 pt-1 cursor-text"
                  onClick={() => inputRef.current?.focus()}
                  onSubmit={handleSubmit}
                >
                  <Avatar className="mb-0.5 size-7! shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <Brain className="size-4!" strokeWidth={2} />
                    </AvatarFallback>
                  </Avatar>
                  <TextareaAutosize
                    ref={inputRef}
                    className="min-h-8 w-full flex-1 resize-none bg-transparent px-1 py-1.5 text-sm shadow-none placeholder:text-slate-400 focus-visible:outline-none focus:ring-0 focus-visible:ring-0 leading-relaxed"
                    maxRows={6}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="针对所选文字进行提问…"
                    value={input}
                  />
                  <Button
                    aria-label="发送"
                    className="mb-0.5 size-7 shrink-0 rounded-full cursor-pointer flex items-center justify-center"
                    disabled={!input.trim()}
                    onMouseDown={(e) => e.stopPropagation()}
                    type="submit"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          </Draggable>
        </div>
      </div>
    </>
  );
}
