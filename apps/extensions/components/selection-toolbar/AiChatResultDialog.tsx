import {
  Button,
  cn,
} from "@repo/ui";
import {
  Check,
  Copy,
  MinusCircle,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FloatingPanel } from "@/components/floating-panel";
import { streamMainSitePost } from "@/lib/auth/stream-main-site";

const OPENAI_COMPAT_PATH = "/api/ai/openai";

function buildSystemPrompt(selectedText: string): string {
  return [
    "用户选中了以下网页文字，请结合其含义回答后续问题。",
    "",
    "【选中文本】",
    selectedText.trim(),
    "",
    "【Markdown 格式要求】",
    "- 使用段落、有序/无序列表、加粗、行内代码与代码块即可。",
    "- 不要使用一级(#)、二级(##)、三级(###)标题。",
    "- 不要使用水平分隔线（---、***、___ 等）。",
    "- 需要强调时用 **加粗** 或短句，不要用大标题层级。",
  ].join("\n");
}

function AiChatMarkdown({ markdown }: { markdown: string }) {
  return (
    <div
      className={cn(
        "prose prose-sm prose-neutral max-w-none text-slate-800",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_p]:text-sm [&_li]:text-sm",
        "[&_hr]:hidden",
        "[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-px [&_code]:text-[13px] [&_code]:text-slate-800 [&_code]:before:content-none [&_code]:after:content-none",
        "[&_pre]:rounded-lg [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:text-slate-900",
        "[&_pre_code]:block [&_pre_code]:w-full [&_pre_code]:whitespace-pre-wrap [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-mono [&_pre_code]:text-[13px] [&_pre_code]:leading-relaxed [&_pre_code]:text-slate-900 [&_pre_code]:shadow-none",
        "[&_ul]:my-2 [&_ol]:my-2",
      )}
    >
      <ReactMarkdown
        components={{
          hr: () => null,
          h1: ({ children }) => (
            <p className="my-2 text-sm font-semibold text-slate-800">{children}</p>
          ),
          h2: ({ children }) => (
            <p className="my-2 text-sm font-semibold text-slate-800">{children}</p>
          ),
          h3: ({ children }) => (
            <p className="my-2 text-sm font-semibold text-slate-800">{children}</p>
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
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

export function AiChatResultDialog({
  selectedText,
  userQuery,
  onClose,
  onBack,
}: AiChatResultDialogProps) {
  const titleText = userQuery.trim().replace(/\s+/g, " ");
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fetchGenRef = useRef(0);
  const streamDisconnectRef = useRef<(() => void) | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const runFetch = useCallback(async () => {
    const myGen = ++fetchGenRef.current;
    setLoading(true);
    setReceiving(true);
    setError(null);
    setCopied(false);
    setAnswer("");
    streamDisconnectRef.current?.();
    streamDisconnectRef.current = null;

    const body = JSON.stringify({
      stream: true,
      system: buildSystemPrompt(selectedText),
      prompt: userQuery.trim(),
    });

    const { done, disconnect } = streamMainSitePost(
      OPENAI_COMPAT_PATH,
      body,
      (delta) => {
        if (myGen !== fetchGenRef.current) {
          return;
        }
        setAnswer((prev) => prev + delta);
        setLoading(false);
      },
    );
    streamDisconnectRef.current = disconnect;

    let result: Awaited<ReturnType<typeof streamMainSitePost>["done"]>;
    try {
      result = await done;
    } catch (e) {
      if (myGen !== fetchGenRef.current) {
        return;
      }
      let msg = "请求失败";
      if (e instanceof Error) {
        msg = e.message;
      }
      setError(msg);
      setLoading(false);
      setReceiving(false);
      return;
    }

    streamDisconnectRef.current = null;

    if (myGen !== fetchGenRef.current) {
      return;
    }

    setReceiving(false);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "请求失败");
    }
  }, [selectedText, userQuery]);

  useEffect(() => {
    void runFetch();
  }, [runFetch]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== undefined) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleStop = () => {
    fetchGenRef.current += 1;
    streamDisconnectRef.current?.();
    streamDisconnectRef.current = null;
    setReceiving(false);
    setLoading(false);
  };

  const handleRetry = () => {
    setCopied(false);
    void runFetch();
  };

  const handleCopy = async () => {
    if (!answer.trim()) return;
    try {
      await navigator.clipboard.writeText(answer);
      if (copyResetTimerRef.current !== undefined) {
        clearTimeout(copyResetTimerRef.current);
      }
      setCopied(true);
      copyResetTimerRef.current = setTimeout(() => {
        setCopied(false);
        copyResetTimerRef.current = undefined;
      }, 2000);
    } catch {
      setError("复制失败，请手动选择文本复制。");
    }
  };

  const footerLoading = (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <Button
        className="h-9 gap-1.5 rounded-full text-slate-600"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleStop}
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
          onClick={onBack}
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
            aria-label={copied ? "已复制" : "复制回答"}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              answer.trim().length > 0
                ? "hover:bg-slate-100 active:bg-slate-200/60"
                : "cursor-not-allowed opacity-40",
            )}
            disabled={answer.trim().length === 0}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => void handleCopy()}
            type="button"
          >
            {copied ? (
              <Check className="size-4 text-emerald-600" strokeWidth={2.5} />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
          <button
            aria-label="重新回答"
            className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-slate-100 active:bg-slate-200/60"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleRetry}
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
      footer={receiving ? footerLoading : footerDone}
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
          {error !== null ? (
            <p className="text-sm text-red-600 wrap-anywhere">{error}</p>
          ) : (
            <>
              {loading && answer.length === 0 ? (
                <LoadingDots />
              ) : (
                <AiChatMarkdown markdown={answer} />
              )}
            </>
          )}
        </div>
      </div>
    </FloatingPanel>
  );
}
