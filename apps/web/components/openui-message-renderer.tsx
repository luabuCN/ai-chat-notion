"use client";

import type { ActionEvent, OpenUIError } from "@openuidev/react-lang";
import { Renderer } from "@openuidev/react-lang";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { useCallback, useEffect, useState } from "react";
import { openuiSafeChatLibrary } from "./openui-chat-library";

class OpenUiRenderBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    resetKey: string;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.warn("OpenUI render failed:", error, errorInfo);
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export function OpenUiLoadingSkeleton() {
  return (
    <div
      aria-label="正在生成界面"
      className="w-full max-w-3xl rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-40 animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-3.5 w-full animate-pulse rounded-full bg-muted/80" />
            <div className="h-3.5 w-[86%] animate-pulse rounded-full bg-muted/80" />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            className="rounded-xl border border-border/60 bg-muted/20 p-3"
            key={item}
          >
            <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-8 w-full animate-pulse rounded-lg bg-muted/80" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OpenUiMessageRenderer({
  text,
  isStreaming,
  onAction,
  fallback,
}: {
  text: string;
  isStreaming: boolean;
  onAction?: (event: ActionEvent) => void;
  fallback: ReactNode;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [text]);

  const handleError = useCallback(
    (errors: OpenUIError[]) => {
      if (!isStreaming && errors.length > 0) {
        setHasError(true);
      }
    },
    [isStreaming]
  );

  if (hasError && !isStreaming) {
    return <>{fallback}</>;
  }

  if (isStreaming && !text.trim()) {
    return <OpenUiLoadingSkeleton />;
  }

  return (
    <div className="openui-chat-theme w-full min-w-0 [&_*]:max-w-full">
      <OpenUiRenderBoundary fallback={fallback} resetKey={text}>
        <Renderer
          isStreaming={isStreaming}
          library={openuiSafeChatLibrary}
          onAction={onAction}
          onError={handleError}
          response={text}
        />
      </OpenUiRenderBoundary>
    </div>
  );
}
