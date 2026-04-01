import { cn } from "@repo/ui";
import type { UIMessage } from "ai";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Response } from "@/components/sidepanel/response";
import { sanitizeText } from "@/lib/sanitize-text";

function ExtensionMessagePart({
  part,
  messageRole,
}: {
  part: NonNullable<UIMessage["parts"]>[number];
  messageRole: UIMessage["role"];
}) {
  if (part.type === "text") {
    const text = part.text?.trim();
    if (!text) {
      return null;
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
            "flex w-full gap-2",
            message.role === "user" ? "justify-end" : "justify-start",
          )}
          data-role={message.role}
          key={message.id}
        >
          {message.role === "assistant" ? (
            <div
              aria-hidden
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-border"
            >
              <Sparkles aria-hidden className="size-3.5 text-primary" />
            </div>
          ) : null}
          <div
            className={cn(
              "space-y-2 text-sm",
              message.role === "user"
                ? "max-w-[min(100%,90%)] shrink-0 text-right"
                : "min-w-0 flex-1 text-left",
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
