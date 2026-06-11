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
