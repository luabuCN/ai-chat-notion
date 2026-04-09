import { Button, cn } from "@repo/ui";
import { MinusCircle } from "lucide-react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const markdownProseClassNames = [
  "prose prose-sm prose-neutral max-w-none text-slate-800",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:text-sm [&_li]:text-sm",
  "[&_hr]:hidden",
  "[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-px [&_code]:text-[13px] [&_code]:text-slate-800 [&_code]:before:content-none [&_code]:after:content-none",
  "[&_pre]:rounded-lg [&_pre]:border [&_pre]:border-slate-200 [&_pre]:bg-slate-100 [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:text-slate-900",
  "[&_pre_code]:block [&_pre_code]:w-full [&_pre_code]:whitespace-pre-wrap [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:font-mono [&_pre_code]:text-[13px] [&_pre_code]:leading-relaxed [&_pre_code]:text-slate-900 [&_pre_code]:shadow-none",
  "[&_ul]:my-2 [&_ol]:my-2",
] as const;

const markdownComponents = {
  hr: () => null,
  h1: ({ children }: { children?: ReactNode }) => (
    <p className="my-2 text-sm font-semibold text-slate-800">{children}</p>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <p className="my-2 text-sm font-semibold text-slate-800">{children}</p>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <p className="my-2 text-sm font-semibold text-slate-800">{children}</p>
  ),
};

export type SelectionResultMarkdownProps = {
  markdown: string;
  className?: string;
};

export function SelectionResultMarkdown({
  markdown,
  className,
}: SelectionResultMarkdownProps) {
  return (
    <div className={cn(...markdownProseClassNames, className)}>
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export type SelectionResultLoadingDotsProps = {
  /** 读屏文案，例如「正在生成回答」「正在翻译」 */
  statusLabel: string;
};

export function SelectionResultLoadingDots({
  statusLabel,
}: SelectionResultLoadingDotsProps) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex items-center gap-1.5 px-1 py-6"
      role="status"
    >
      <span className="sr-only">{statusLabel}</span>
      <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="size-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
      <span className="size-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

export type SelectedTextSnippetProps = {
  text: string;
};

export function SelectedTextSnippet({ text }: SelectedTextSnippetProps) {
  return (
    <div className="border-b border-slate-200/80 pb-3">
      <div className="rounded-xl bg-slate-100/90 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
        <p
          className={cn(
            "text-[13px] text-slate-700 line-clamp-2",
            "wrap-anywhere overflow-hidden",
          )}
        >
          {text.trimStart()}
        </p>
      </div>
    </div>
  );
}

export type StreamingStopFooterProps = {
  onStop: () => void;
};

export function StreamingStopFooter({ onStop }: StreamingStopFooterProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5">
      <Button
        className="h-9 gap-1.5 rounded-full text-slate-600"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onStop}
        type="button"
        variant="ghost"
      >
        <MinusCircle className="size-5 text-slate-500" strokeWidth={2} />
        停止
      </Button>
    </div>
  );
}
