import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import {
  Check,
  ChevronDown,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FloatingPanel } from "@/components/floating-panel";
import {
  SelectedTextSnippet,
  SelectionResultLoadingDots,
  SelectionResultMarkdown,
  StreamingStopFooter,
} from "@/components/selection-toolbar/selection-result-shared";
import { streamMainSitePost } from "@/lib/auth/stream-main-site";
import { useExtensionPortalContainer } from "@/lib/extension-portal-context";
import {
  type TranslationLanguage,
  TRANSLATION_LANGUAGES,
  getTranslationLanguageById,
} from "@/lib/translation-languages";

const OPENAI_COMPAT_PATH = "/api/ai/openai";

function buildTranslationSystemPrompt(
  selectedText: string,
  target: TranslationLanguage,
): string {
  return [
    "你是专业翻译。用户选中了以下网页文字，请将其完整翻译为目标语言。",
    "",
    "【选中文本】",
    selectedText.trim(),
    "",
    "【目标语言】",
    `${target.labelZh}（${target.nativeName}）`,
    "",
    "【输出要求】",
    "- 只输出译文，不要前言、解释或「译文如下」等套话。",
    "- 不要使用一级(#)、二级(##)、三级(###)标题。",
    "- 不要使用水平分隔线。",
    "- 保持段落与列表结构可读；需要强调时可用 **加粗**。",
  ].join("\n");
}

const TRANSLATION_USER_PROMPT = "请输出完整译文。";

type TranslateResultDialogProps = {
  selectedText: string;
  initialLanguageId: string;
  onClose: () => void;
  /**
   * 由 SelectionToolbarHost 传入的 Shadow 内 portal 节点；lazy 子树内 Context 可能缺失时仍能保证下拉有样式。
   */
  extensionPortalHost?: HTMLElement | null;
};

export function TranslateResultDialog({
  selectedText,
  initialLanguageId,
  onClose,
  extensionPortalHost: extensionPortalHostProp,
}: TranslateResultDialogProps) {
  const portalFromContext = useExtensionPortalContainer();
  const [portalFromShadow, setPortalFromShadow] = useState<HTMLElement | null>(
    null,
  );
  const langTriggerRef = useRef<HTMLButtonElement>(null);

  const menuPortalContainer =
    extensionPortalHostProp ?? portalFromContext ?? portalFromShadow;

  useLayoutEffect(() => {
    if (extensionPortalHostProp ?? portalFromContext) {
      return;
    }
    const el = langTriggerRef.current;
    if (!el) {
      return;
    }
    const root = el.getRootNode();
    if (root instanceof ShadowRoot) {
      const host = root.querySelector("[data-extension-portal-host]");
      if (host instanceof HTMLElement) {
        setPortalFromShadow(host);
      }
    }
  }, [extensionPortalHostProp, portalFromContext]);

  const [targetLanguageId, setTargetLanguageId] = useState(initialLanguageId);
  const targetLang =
    getTranslationLanguageById(targetLanguageId) ?? TRANSLATION_LANGUAGES[0];

  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [continueChatError, setContinueChatError] = useState<string | null>(
    null,
  );
  const fetchGenRef = useRef(0);
  const streamDisconnectRef = useRef<(() => void) | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const runFetch = useCallback(async () => {
    const lang =
      getTranslationLanguageById(targetLanguageId) ?? TRANSLATION_LANGUAGES[0];
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
      system: buildTranslationSystemPrompt(selectedText, lang),
      prompt: TRANSLATION_USER_PROMPT,
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
  }, [selectedText, targetLanguageId]);

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

  const footerLoading = <StreamingStopFooter onStop={handleStop} />;

  const footerDone = (
    <div className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1" />
        <div className="flex shrink-0 items-center gap-1 text-slate-600">
          <button
            aria-label={copied ? "已复制" : "复制译文"}
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
            aria-label="重新翻译"
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

  const titleAddon = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex max-w-[min(200px,40vw)] shrink items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-left text-[13px] font-medium text-slate-800 outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onMouseDown={(e) => e.stopPropagation()}
          ref={langTriggerRef}
          type="button"
        >
          <span className="truncate">{targetLang.labelZh}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-[2147483647] max-h-[min(320px,calc(100vh-120px))] w-[min(100vw-24px,280px)] overflow-y-auto border border-slate-200 bg-white p-1 text-slate-900 shadow-md"
        container={menuPortalContainer}
        side="bottom"
        sideOffset={6}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {TRANSLATION_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            className={cn(
              "cursor-pointer flex-col items-start gap-0.5 py-2",
              lang.id === targetLanguageId && "bg-accent",
            )}
            key={lang.id}
            onSelect={() => setTargetLanguageId(lang.id)}
          >
            <span className="w-full font-medium leading-tight">{lang.labelZh}</span>
            <span className="w-full text-[12px] leading-tight text-slate-500">
              {lang.nativeName}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <FloatingPanel
      bodyClassName="px-0 py-0"
      defaultHeight={560}
      defaultWidth={520}
      footer={receiving ? footerLoading : footerDone}
      onClose={onClose}
      title="翻译"
      titleAddon={titleAddon}
    >
      <div className="flex min-h-0 flex-col px-3 pb-2 pt-1.5">
        <SelectedTextSnippet text={selectedText} />
        <div className="min-h-[120px] px-1 pt-3">
          {continueChatError !== null ? (
            <p className="mb-2 text-sm text-red-600 wrap-anywhere">
              {continueChatError}
            </p>
          ) : null}
          {error !== null ? (
            <p className="text-sm text-red-600 wrap-anywhere">{error}</p>
          ) : (
            <>
              {loading && answer.length === 0 ? (
                <SelectionResultLoadingDots statusLabel="正在翻译" />
              ) : (
                <SelectionResultMarkdown
                  className="text-[15px] leading-relaxed"
                  markdown={answer}
                />
              )}
            </>
          )}
        </div>
      </div>
    </FloatingPanel>
  );
}
