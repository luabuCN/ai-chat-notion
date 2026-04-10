import { cn, ImagePreview } from "@repo/ui";
import type { UIMessage } from "ai";
import { Globe, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Response } from "@/components/sidepanel/response";
import { sanitizeText } from "@/lib/sanitize-text";
import {
  parseSummarizePageMeta,
  type SummarizePageMeta,
} from "@/lib/summarize-page-message";

function SummarizePageCard({ meta }: { meta: SummarizePageMeta }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const url = meta.url?.trim() ?? "";

  const cardClassName = cn(
    "flex items-center gap-2 rounded-xl border border-border/70 bg-background px-2.5 py-2 shadow-xs",
    url.length > 0 &&
      "w-full cursor-pointer text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
            void browser.tabs.create({ url });
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

function ExtensionMessagePart({
  part,
  messageRole,
}: {
  part: NonNullable<UIMessage["parts"]>[number];
  messageRole: UIMessage["role"];
}) {
  if (part.type === "file") {
    const url = "url" in part && typeof part.url === "string" ? part.url : "";
    if (!url) {
      return null;
    }
    const mediaType =
      "mediaType" in part && typeof part.mediaType === "string"
        ? part.mediaType
        : "";
    const fileName =
      "name" in part && typeof part.name === "string"
        ? part.name
        : "filename" in part && typeof part.filename === "string"
          ? part.filename
          : "附件";

    const alignClass =
      messageRole === "user" ? "flex flex-row justify-end" : "flex flex-row justify-start";

    if (mediaType.startsWith("image/")) {
      return (
        <div className={cn("gap-2", alignClass)}>
          <ImagePreview src={url}>
            <button
              aria-label="查看图片"
              className="relative flex size-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-border/50 bg-muted/50 p-0 aspect-square"
              type="button"
            >
              <img alt="" className="size-full object-cover" src={url} />
            </button>
          </ImagePreview>
        </div>
      );
    }

    if (mediaType.startsWith("video/")) {
      return (
        <div className={alignClass}>
          <a
            className="max-w-full truncate rounded-lg border border-border/50 bg-muted/40 px-2 py-1.5 text-foreground text-xs"
            href={url}
            rel="noopener noreferrer"
            target="_blank"
          >
            视频：{fileName}
          </a>
        </div>
      );
    }

    return (
      <div className={alignClass}>
        <a
          className="max-w-full truncate rounded-lg border border-border/50 bg-muted/40 px-2 py-1.5 text-left text-foreground text-xs"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {fileName}
        </a>
      </div>
    );
  }

  if (part.type === "text") {
    const text = part.text?.trim();
    if (!text) {
      return null;
    }

    if (messageRole === "user") {
      const meta = parseSummarizePageMeta(text);
      if (meta) {
        return <SummarizePageCard meta={meta} />;
      }
    }

    return (
      <div
        className={cn(
          "wrap-break-word rounded-2xl px-3 py-2",
          messageRole === "user"
            ? "bg-[#f4f4f4] text-right text-white whitespace-pre-wrap"
            : "bg-transparent px-2 py-1 text-left text-foreground",
        )}
      >
        <Response>{sanitizeText(text)}</Response>
      </div>
    );
  }

  if (part.type === "reasoning" && part.text) {
    if (part.text === "[REDACTED]" && part.state === "done") {
      return null;
    }
    const loading =
      part.state === "streaming" ||
      (part.text === "[REDACTED]" && part.state !== "done");
    return (
      <details className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-left text-muted-foreground text-xs">
        <summary className="cursor-pointer select-none font-medium text-foreground">
          {loading ? "思考中…" : "思考过程"}
        </summary>
        <p className="mt-1 whitespace-pre-wrap">{part.text}</p>
      </details>
    );
  }

  if (part.type === "dynamic-tool") {
    return null;
  }
  if (part.type.startsWith("tool-")) {
    return null;
  }

  return null;
}

export function ExtensionMessageList({ messages }: { messages: UIMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-2 py-2">
      {messages.map((message) => (
        <div
          className={cn(
            "flex w-full",
            message.role === "user"
              ? "justify-end gap-2"
              : "flex-col items-start gap-2",
          )}
          data-role={message.role}
          key={message.id}
        >
          {message.role === "assistant" ? (
            <div
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border"
            >
              <Sparkles aria-hidden className="size-3.5 text-primary" />
            </div>
          ) : null}
          <div
            className={cn(
              "space-y-2 text-sm",
              message.role === "user"
                ? "max-w-[min(100%,90%)] shrink-0 text-right"
                : "w-full min-w-0 text-left",
            )}
          >
            {message.parts?.map((part, index) => (
              <ExtensionMessagePart
                key={`${message.id}-${index}`}
                messageRole={message.role}
                part={part}
              />
            ))}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
