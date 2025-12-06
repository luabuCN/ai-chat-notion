"use client";

import { useEffect, useState } from "react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "./elements/reasoning";

type MessageReasoningProps = {
  isLoading: boolean;
  reasoning: string;
};

export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [hasBeenStreaming, setHasBeenStreaming] = useState(isLoading);
  const isRedacted = reasoning === "[REDACTED]";
  const isStreaming = isLoading || isRedacted;

  useEffect(() => {
    if (isStreaming) {
      setHasBeenStreaming(true);
    }
  }, [isStreaming]);

  return (
    <Reasoning
      data-testid="message-reasoning"
      defaultOpen={hasBeenStreaming}
      isStreaming={isStreaming}
    >
      <ReasoningTrigger />
      {!isRedacted && <ReasoningContent>{reasoning}</ReasoningContent>}
    </Reasoning>
  );
}
