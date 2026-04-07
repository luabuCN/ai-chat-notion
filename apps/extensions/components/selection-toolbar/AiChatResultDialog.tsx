import {
  Button,
  cn,
} from "@repo/ui";
import {
  Copy,
  MinusCircle,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FloatingPanel } from "@/components/floating-panel";

function AiChatMarkdown({ markdown }: { markdown: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-neutral max-w-none text-slate-800",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:text-sm [&_li]:text-sm",
        "[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-px [&_code]:text-[13px] [&_code]:before:content-none [&_code]:after:content-none",
        "[&_pre]:rounded-lg [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:text-[13px]",
        "[&_ul]:my-2 [&_ol]:my-2",
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
type AiChatResultDialogProps = {
  selectedText: string;
  userQuery: string;
  onClose: () => void;
  /** 返回上一层输入框 */
  onBack: () => void;
};

function LoadingDots() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex items-center gap-1.5 px-1 py-6"
      role="status"
    >
      <span className="sr-only">正在生成回答</span>
      <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
      <span className="size-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

/** 演示用占位回答（图二：含加粗、行内代码、列表），接入接口后替换为真实流式文本 */
const DEMO_ANSWER = `根据你描述的接口逻辑，可以这样理解 **报名状态展示规则**：

1. 前端在选中批次后调用接口拉取 **批次设置**。
2. 读取字段 \`zccxxssfzdbm\` 的值：
   - **1**：自动报名 → 隐藏「报名状态」相关选择。
   - **0**：手动报名 → 展示「报名状态」选择。

若需要更细的交互说明，可补充接口返回示例。`;

export function AiChatResultDialog({
  selectedText,
  userQuery,
  onClose,
  onBack,
}: AiChatResultDialogProps) {
  const titleText = userQuery.trim().replace(/\s+/g, " ");
  const [loading, setLoading] = useState(true);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setAnswer(DEMO_ANSWER);
      setLoading(false);
    }, 1800);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const footerLoading = (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <Button
        className="h-9 gap-1.5 rounded-full text-slate-600"
        onMouseDown={(e) => e.stopPropagation()}
        type="button"
        variant="ghost"
      >
        <MinusCircle className="size-5 text-slate-500" strokeWidth={2} />
        停止
      </Button>
    </div>
  );

  const footerDone = (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <Button
          className="h-9 gap-2 rounded-full px-3.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
          onMouseDown={(e) => e.stopPropagation()}
          type="button"
          variant="ghost"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="size-4" strokeWidth={2} />
          </span>
          继续聊天
        </Button>
        <div className="flex shrink-0 items-center gap-1 text-slate-600">
          <button
            aria-label="复制"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100 active:bg-slate-200/60"
            onMouseDown={(e) => e.stopPropagation()}
            type="button"
          >
            <Copy className="size-4" />
          </button>
          <button
            aria-label="重新回答"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100 active:bg-slate-200/60"
            onMouseDown={(e) => e.stopPropagation()}
            type="button"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <FloatingPanel
      bodyClassName="px-0 py-0"
      defaultHeight={560}
      defaultWidth={520}
      footer={loading ? footerLoading : footerDone}
      onBack={onBack}
      onClose={onClose}
      title={titleText || "AI 助手"}
    >
      <div className="flex min-h-0 flex-col px-3 pb-2 pt-1.5">
        <div className="border-b border-slate-200/80 pb-3">
          <div className="rounded-xl bg-slate-100/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <p
              className={cn(
                "text-[13px] text-slate-700 line-clamp-2",
                "wrap-anywhere overflow-hidden",
              )}
            >
              {selectedText.trimStart()}
            </p>
          </div>
        </div>
        <div className="min-h-[120px] px-1 pt-3">
          {loading ? (
            <LoadingDots />
          ) : (
            <AiChatMarkdown markdown={answer} />
          )}
        </div>
      </div>
    </FloatingPanel>
  );
}
