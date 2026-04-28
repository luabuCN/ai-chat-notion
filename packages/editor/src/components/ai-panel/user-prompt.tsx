import { WandSparkles, Send, Loader2 } from "lucide-react";
import { Input } from "@repo/ui/input";
import { Button } from "@repo/ui/button";
import { useAIPanelStore } from "./ai-panel-store";
import { useCallback, useEffect, useRef, useState } from "react";
// import { debounce } from "lodash-es"; // Check if we have lodash-es
import scrollIntoView from "scroll-into-view-if-needed";
import { cn } from "../../lib/utils";

// Simple debounce implementation if lodash-es is not present or to avoid dependency
function debounce(fn: Function, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  const debounced = function (this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

export function UserPrompt() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const editor = useAIPanelStore((state) => state.editor);
  const isThinking = useAIPanelStore((state) => state.isThinking);
  const isVisible = useAIPanelStore((state) => state.isVisible);
  const result = useAIPanelStore((state) => state.result);
  const isStreaming = useAIPanelStore((state) => state.isStreaming);
  const prompt = useAIPanelStore((state) => state.prompt);
  const setPrompt = useAIPanelStore((state) => state.setPrompt);
  const setInputFocused = useAIPanelStore((state) => state.setInputFocused);
  const submitUserPrompt = useAIPanelStore((state) => state.submitUserPrompt);
  const setVisible = useAIPanelStore((state) => state.setVisible);
  const stopStream = useAIPanelStore((state) => state.stopStream);

  const placeholder = isThinking
    ? "AI is thinking..."
    : isStreaming
    ? "AI is writing..."
    : "Ask AI anything...";
  const statusText = isThinking
    ? "AI is thinking..."
    : isStreaming
    ? "AI is writing..."
    : "";

  const isEmptyPrompt = !prompt.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((isThinking || isStreaming) && e.key === "Enter") {
      e.preventDefault();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      submitUserPrompt();
    }
    if (e.key === "Escape") {
      setVisible(false);
      editor?.commands.focus();
    }
  };

  const handleStop = () => {
    stopStream();
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((isThinking || isStreaming) && e.key === "Escape") {
        handleStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isThinking, isStreaming, stopStream]);

  // Create debounced scroll function
  const debouncedScroll = useCallback(
    debounce((ref: HTMLDivElement) => {
      scrollIntoView(ref, {
        scrollMode: "if-needed",
        block: "nearest",
        behavior: "smooth",
      });
    }, 16),
    []
  );

  useEffect(() => {
    if (isVisible && inputRef.current && (result || isStreaming)) {
      debouncedScroll(inputRef.current as any);
    }

    return () => {
      (debouncedScroll as any).cancel();
    };
  }, [isVisible, result, isStreaming, debouncedScroll]);

  return (
    <div className="ai-panel-input flex w-full items-center rounded-xl border border-violet-200/70 bg-white/95 p-1 text-popover-foreground shadow-[0_18px_45px_rgba(124,58,237,0.16)] ring-1 ring-violet-100/80 backdrop-blur dark:border-violet-500/25 dark:bg-background/95 dark:ring-violet-500/15">
      <WandSparkles className="mx-2.5 h-4 w-4 text-violet-500" />
      <Input
        ref={inputRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={handleKeyDown}
        disabled={isThinking || isStreaming}
      />
      {statusText ? (
        <span className="mr-1 whitespace-nowrap text-muted-foreground text-xs">
          {statusText}
        </span>
      ) : null}
      <Button
        size="icon"
        variant="ghost"
        onClick={() =>
          isThinking || isStreaming ? handleStop() : submitUserPrompt()
        }
        disabled={isEmptyPrompt && !(isThinking || isStreaming)}
        className="h-8 w-8 rounded-lg text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-300 dark:hover:bg-violet-500/10"
      >
        {isThinking || isStreaming ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
