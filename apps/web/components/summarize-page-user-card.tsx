"use client";

import { Globe } from "lucide-react";
import { useState } from "react";
import type { SummarizePageMeta } from "@/lib/summarize-page-message";
import { cn } from "@/lib/utils";

export function SummarizePageUserCard({ meta }: { meta: SummarizePageMeta }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const url = meta.url?.trim() ?? "";

  const cardClassName = cn(
    "flex items-center gap-2 rounded-xl border border-border/70 bg-background px-2.5 py-2 text-left shadow-xs",
    url.length > 0 &&
      "w-full cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  );

  const cardInner = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded">
        {meta.favIconUrl && !faviconFailed ? (
          <img
            alt=""
            className="size-5 object-contain"
            decoding="async"
            onError={() => {
              setFaviconFailed(true);
            }}
            src={meta.favIconUrl}
          />
        ) : (
          <Globe aria-hidden className="size-4 text-muted-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {meta.title}
        </p>
        {url.length > 0 ? (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {url}
          </p>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="space-y-1.5 text-left">
      {url.length > 0 ? (
        <button
          aria-label={`打开网页：${meta.title}`}
          className={cardClassName}
          onClick={() => {
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          type="button"
        >
          {cardInner}
        </button>
      ) : (
        <div className={cardClassName}>{cardInner}</div>
      )}
      <span className="inline-block rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        总结网页
      </span>
    </div>
  );
}
