import { Button } from "@repo/ui";
import { Loader2 } from "lucide-react";
import type { HTMLAttributes } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FloatingPanel } from "@/components/floating-panel";
import { useExtensionPortalContainer } from "@/lib/extension-portal-context";

type ImageExtractTextPopoverProps = {
  error: string | null;
  onClose: () => void;
  phase: "loading" | "done";
  text: string;
};

export function ImageExtractTextPopover({
  error,
  onClose,
  phase,
  text,
}: ImageExtractTextPopoverProps) {
  const portalHost = useExtensionPortalContainer();
  const [copied, setCopied] = useState(false);
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopied(false);
  }, [text]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const panel = (
    <FloatingPanel
      bodyClassName="px-3 py-3"
      closeOnBackdrop
      defaultHeight={320}
      defaultWidth={360}
      minHeight={200}
      minWidth={280}
      onClose={onClose}
      rootProps={
        {
          "data-wisewrite-ocr-popover": "",
        } as HTMLAttributes<HTMLDivElement>
      }
      title="提取的文字"
      footer={
        phase === "done" && error === null ? (
          <div className="flex justify-end bg-white px-3 py-2">
            <Button
              className="rounded-lg px-4"
              onClick={() => {
                void (async () => {
                  try {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    if (copyResetTimeoutRef.current !== null) {
                      clearTimeout(copyResetTimeoutRef.current);
                    }
                    copyResetTimeoutRef.current = setTimeout(() => {
                      setCopied(false);
                      copyResetTimeoutRef.current = null;
                    }, 2000);
                  } catch {
                    /* 剪贴板不可用时忽略 */
                  }
                })();
              }}
              type="button"
            >
              {copied ? "已复制" : "复制"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {phase === "loading" ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-2">
          <Loader2
            aria-hidden
            className="size-8 animate-spin text-primary"
            strokeWidth={2}
          />
          <span className="text-muted-foreground text-[14px] font-sans">正在识别…</span>
        </div>
      ) : error !== null ? (
        <p className="text-destructive text-[14px] leading-relaxed font-sans" role="alert">
          {error}
        </p>
      ) : (
        <pre className="wrap-break-word whitespace-pre-wrap font-mono text-slate-800 text-[14px] font-normal leading-relaxed ">
          {text.length > 0 ? text : "未识别到文字"}
        </pre>
      )}
    </FloatingPanel>
  );

  if (portalHost === null) {
    return null;
  }
  return createPortal(panel, portalHost);
}
