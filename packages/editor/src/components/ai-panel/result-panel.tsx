import { cn } from "../../lib/utils";
import { AlertCircle, WandSparkles } from "lucide-react";
import { Button } from "@repo/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIResultPanelProps {
  result?: string;
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
  error,
  className,
}: AIResultPanelProps) {
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
        "relative mb-2 max-h-[22rem] overflow-x-hidden overflow-y-auto custom-scrollbar rounded-2xl border",
        "border-violet-200/75 bg-white/95 p-4 shadow-[0_18px_45px_rgba(124,58,237,0.16)] ring-1 ring-violet-100/90 backdrop-blur",
        "dark:border-violet-500/25 dark:bg-background/95 dark:ring-violet-500/15",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3 border-violet-100/80 border-b pb-2 dark:border-violet-500/15">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <WandSparkles className="h-3.5 w-3.5" />
          </span>
          <span>AI 回答</span>
        </div>
        <span className="text-muted-foreground text-xs">引用内容</span>
      </div>
      <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-pre:my-3 prose-li:my-1 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
      </div>
    </div>
  );
}
