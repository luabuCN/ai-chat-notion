import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence } from "framer-motion";
import { ArrowDownIcon } from "lucide-react";
import { memo, useEffect } from "react";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@repo/database";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import { Conversation, ConversationContent } from "./elements/conversation";
import { PreviewMessage, ThinkingMessage } from "./message";

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  selectedModelId: string;
};

function assistantPartHasVisibleContent(
  part: ChatMessage["parts"][number]
): boolean {
  if (part.type === "text" && part.text?.trim()) {
    return true;
  }

  if (
    part.type === "reasoning" &&
    "text" in part &&
    part.text &&
    part.text !== "[REDACTED]"
  ) {
    return true;
  }

  if (part.type.startsWith("tool-")) {
    return true;
  }

  return false;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
  } = useMessages();

  const isArtifactStreaming = useArtifactSelector(
    (state) => state.status === "streaming"
  );

  useDataStream();
  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "auto",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  const lastMessage = messages.at(-1);
  const lastMessageHasVisibleContent =
    lastMessage?.parts?.some(assistantPartHasVisibleContent) ?? false;

  const showThinking =
    !isArtifactStreaming &&
    (status === "submitted" ||
      (status === "streaming" &&
        messages.length > 0 &&
        lastMessage?.role === "assistant" &&
        !lastMessageHasVisibleContent));

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll"
      ref={messagesContainerRef}
      style={{ overflowAnchor: "none" }}
    >
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            const isEmptyAssistantMessage =
              isLastMessage &&
              message.role === "assistant" &&
              status === "streaming" &&
              !message.parts?.some(assistantPartHasVisibleContent);

            // 如果最后一条消息是空的 assistant 消息且在 streaming，则不渲染
            if (isEmptyAssistantMessage) {
              return null;
            }

            return (
              <PreviewMessage
                chatId={chatId}
                isLoading={status === "streaming" && isLastMessage}
                isReadonly={isReadonly}
                key={message.id}
                message={message}
                messages={messages}
                regenerate={regenerate}
                setMessages={setMessages}
                vote={
                  votes
                    ? votes.find((vote) => vote.messageId === message.id)
                    : undefined
                }
              />
            );
          })}

          <AnimatePresence mode="wait">
            {showThinking && <ThinkingMessage key="thinking" />}
          </AnimatePresence>

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <button
          aria-label="Scroll to bottom"
          className="-translate-x-1/2 absolute bottom-40 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status === "streaming" || nextProps.status === "streaming") {
    return false;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return true;
});
