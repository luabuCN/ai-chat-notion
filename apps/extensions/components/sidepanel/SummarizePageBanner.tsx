import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { BookOpen, Globe, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActiveTabPageInfo } from "@/hooks/use-active-tab-page-info";
import {
  extractReadabilityFromTab,
} from "@/lib/extract-readability-from-tab";
import type { SummarizePageMeta } from "@/lib/summarize-page-message";

type SummarizePageBannerProps = {
  /** 是否为占位数据（弱化标题样式，仅用于布局预览） */
  isPlaceholder?: boolean;
  onDismiss: () => void;
  onSummarize?: (meta: SummarizePageMeta, articleText: string) => void;
  page: ActiveTabPageInfo;
  className?: string;
};

/**
 * 侧栏网站摘要条：关闭钮贴在卡片右上角顶点外侧（跨边圆形）；悬停卡片时显示。
 */
export function SummarizePageBanner({
  isPlaceholder = false,
  onDismiss,
  onSummarize,
  page,
  className,
}: SummarizePageBannerProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [readabilityBusy, setReadabilityBusy] = useState(false);

  useEffect(() => {
    setFaviconFailed(false);
  }, [page.favIconUrl]);

  const summarizeDisabled =
    isPlaceholder ||
    !page.canExtractReadableContent ||
    page.tabId === undefined ||
    readabilityBusy;

  const pageUrl = page.url?.trim() ?? "";
  const canOpenPageUrl =
    !isPlaceholder && pageUrl.length > 0 && page.canExtractReadableContent;

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-h-0 shrink-0 overflow-visible pt-1.5 pr-1.5",
          className,
        )}
      >
        <div
          className={cn(
            "group relative flex min-h-[44px] shrink-0 items-center gap-2.5 overflow-visible rounded-2xl border border-border/70 bg-background px-2.5 py-2 pr-2 shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
          )}
        >
         <Button
            aria-label="关闭"
            className={cn(
              "absolute top-0 right-0 z-20 size-6 -translate-y-1/2 translate-x-1/2",
              "rounded-full border border-border/60 bg-muted/95 text-muted-foreground shadow-sm",
              "hover:bg-muted hover:text-foreground",
              "pointer-events-none opacity-0 transition-opacity duration-150",
              "group-hover:pointer-events-auto group-hover:opacity-100",
              "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
              "focus-visible:pointer-events-auto focus-visible:opacity-100",
            )}
            onClick={onDismiss}
            type="button"
            variant="ghost"
            size={'icon'}
          >
            <X className="size-3" strokeWidth={2.5} />
          </Button>

          {canOpenPageUrl ? (
            <button
              aria-label={`打开网页：${page.title}`}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg pr-1 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => {
                void browser.tabs.create({ url: pageUrl });
              }}
              type="button"
            >
              <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                {page.favIconUrl && !faviconFailed ? (
                  <img
                    alt=""
                    className="size-6 object-contain"
                    decoding="async"
                    height={24}
                    onError={() => {
                      setFaviconFailed(true);
                    }}
                    src={page.favIconUrl}
                    width={24}
                  />
                ) : (
                  <Globe aria-hidden className="size-4 text-muted-foreground" />
                )}
              </span>
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-[13px] leading-snug tracking-tight",
                  isPlaceholder ? "text-muted-foreground" : "text-foreground",
                )}
                title={page.title}
              >
                {page.title}
              </p>
            </button>
          ) : (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/50 bg-muted/30">
                {page.favIconUrl && !faviconFailed ? (
                  <img
                    alt=""
                    className="size-6 object-contain"
                    decoding="async"
                    height={24}
                    onError={() => {
                      setFaviconFailed(true);
                    }}
                    src={page.favIconUrl}
                    width={24}
                  />
                ) : (
                  <Globe aria-hidden className="size-4 text-muted-foreground" />
                )}
              </span>
              <p
                className={cn(
                  "min-w-0 flex-1 truncate pr-1 text-[13px] leading-snug tracking-tight",
                  isPlaceholder ? "text-muted-foreground" : "text-foreground",
                )}
                title={page.title}
              >
                {page.title}
              </p>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-busy={readabilityBusy}
                aria-label="总结此页面"
                className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={summarizeDisabled}
                onClick={() => {
                  const tabId = page.tabId;
                  if (summarizeDisabled || tabId === undefined) {
                    return;
                  }
                  void (async () => {
                    setReadabilityBusy(true);
                    try {
                      const result = await extractReadabilityFromTab(tabId);
                      if (result.ok && result.article?.textContent) {
                        onSummarize?.(
                          {
                            title: page.title,
                            url: page.url ?? "",
                            favIconUrl: page.favIconUrl,
                          },
                          result.article.textContent,
                        );
                      }
                    } finally {
                      setReadabilityBusy(false);
                    }
                  })();
                }}
                type="button"
                variant="ghost"
              >
                {readabilityBusy ? (
                  <Loader2
                    aria-hidden
                    className="size-4 animate-spin"
                    strokeWidth={2}
                  />
                ) : (
                  <BookOpen className="size-4" strokeWidth={2} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {isPlaceholder || !page.canExtractReadableContent
                ? "请在普通网页标签页使用"
                : "总结此页面"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
