import { WandSparkles, Send, CircleStop } from "lucide-react";
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

  const isEmptyPrompt = !prompt.trim();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
      if (isStreaming && e.key === "Escape") {
        handleStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStreaming, stopStream]);

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
    <div className="ai-panel-input flex items-center w-full rounded-md border bg-popover dark:bg-popover p-0.5 text-popover-foreground">
      <WandSparkles className="mx-2.5 w-4 h-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-0 border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        onKeyDown={handleKeyDown}
        disabled={isThinking}
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => (isStreaming ? handleStop() : submitUserPrompt())}
        disabled={isEmptyPrompt && !isStreaming}
        className="h-8 w-8"
      >
        {isThinking || isStreaming ? (
          <CircleStop className="w-5 h-5 text-primary" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}
