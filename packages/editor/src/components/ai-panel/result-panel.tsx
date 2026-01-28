import { cn } from "../../lib/utils";
import { AlertCircle } from "lucide-react";
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
      <div className="bg-popover dark:bg-popover mb-4 p-4 rounded-lg border border-destructive/50 text-destructive">
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
        "relative mb-2 max-h-80 overflow-x-hidden overflow-y-auto custom-scrollbar rounded-lg border",
        "bg-popover dark:bg-popover p-4 shadow-md",
        "prose prose-sm dark:prose-invert max-w-none",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
    </div>
  );
}
