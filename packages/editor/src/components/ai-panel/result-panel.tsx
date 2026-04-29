import { cn } from "../../lib/utils";
import { AlertCircle, WandSparkles } from "lucide-react";
import { Button } from "@repo/ui/button";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIResultPanelProps {
  result?: string;
  isStreaming?: boolean;
  error?: {
    message: string;
    code?: string;
    action?: {
      label: string;
      handler: () => void;
    };
  } | null;
  className?: string;
}

export default function AIResultPanel({
  result,
  isStreaming = false,
  error,
  className,
}: AIResultPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isStreaming || !result) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      container.scrollTop = container.scrollHeight;
    });

    return () => cancelAnimationFrame(frame);
  }, [isStreaming, result]);

  if (error) {
    return (
      <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive shadow-lg">
        <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Error</span>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p>{error.message}</p>
          {error.action && (
            <Button
              variant="outline"
              size="sm"
              onClick={error.action.handler}
              className="w-fit"
            >
              {error.action.label}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div
      className={cn(
        "relative mb-2 flex max-h-[22rem] flex-col overflow-hidden rounded-2xl border border-border/70",
        "bg-background/98",
        "dark:border-border/70 dark:bg-background/95",
        className
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-border/70 border-b bg-background/98 px-4 py-3 dark:bg-background/95">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted text-primary">
            <WandSparkles className="h-3.5 w-3.5" />
          </span>
          <span>AI 回答</span>
        </div>
      </div>
      <div
        ref={scrollContainerRef}
        className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 pt-3"
      >
        <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-pre:my-3 prose-li:my-1 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
