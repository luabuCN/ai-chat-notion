"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRInfinite from "swr/infinite";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import type { Vote } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { createChatHistoryPaginationKey, getChatHistoryPaginationKey, type ChatHistory } from "./sidebar-history";
import { toast } from "./toast";


export function Chat({
  id,
  initialMessages,
  initialChatModel,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const workspaceSlugRef = useRef(workspaceSlug);

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
    workspaceSlugRef.current = workspaceSlug;
  }, [currentModelId, workspaceSlug]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const modelId = currentModelIdRef.current;
        // Backward compatibility: keep legacy placeholder ids out of API payload.
        const isLegacyModelId = modelId.startsWith("chat-model");

        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedModelSlug: isLegacyModelId ? undefined : modelId,
            workspaceSlug: workspaceSlugRef.current || undefined,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      console.error("chat error:", error);

      if (error instanceof ChatSDKError) {
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      } else {
        toast({
          type: "error",
          description:
            error.message || "发生错误，请稍后重试",
        });
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  const { data: history } = useSWRInfinite<ChatHistory>(
    (index) => createChatHistoryPaginationKey()(index, null as any),
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  useEffect(() => {
    if (history) {
      const allChats = history.flatMap((h) => h.chats);
      const currentChat = allChats.find((c) => c.id === id);
      if (currentChat?.title) {
        window.document.title = `${currentChat.title} - 知作`;
      }
    }
  }, [id, history]);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/${workspaceSlug}/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id, workspaceSlug]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  const isHomeState = messages.length === 0 && status === "ready";

  return (
    <>
      <div className="overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col overflow-hidden bg-background">
        <ChatHeader chatId={id} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            {!isHomeState && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                exit={{ opacity: 0, y: -12 }}
                initial={{ opacity: 0, y: 12 }}
                key="messages"
                transition={{ duration: 0.28, ease: "easeOut" }}
              >
                <Messages
                  chatId={id}
                  isArtifactVisible={isArtifactVisible}
                  isReadonly={isReadonly}
                  messages={messages}
                  regenerate={regenerate}
                  selectedModelId={initialChatModel}
                  setMessages={setMessages}
                  status={status}
                  votes={votes}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {!isReadonly && (
            <motion.div
              className={
                isHomeState
                  ? "mx-auto flex w-full max-w-4xl flex-1 flex-col px-2 pt-8 pb-8 md:px-4 md:pt-10 md:pb-10"
                  : "shrink-0 z-10 mx-auto flex w-full max-w-4xl gap-2 bg-background px-2 pb-3 md:px-4 md:pb-4"
              }
              transition={{ duration: 0.24 }}
            >
              <div
                className={
                  isHomeState ? "flex min-h-0 flex-1 flex-col" : "w-full"
                }
              >
                <MultimodalInput
                  attachments={attachments}
                  chatId={id}
                  greeting={
                    isHomeState ? (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        initial={{ opacity: 0, y: 24 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        <Greeting />
                      </motion.div>
                    ) : undefined
                  }
                  input={input}
                  landingInputOffsetClassName="mt-4 md:mt-6"
                  landingPanelsPosition={isHomeState ? "bottom" : "inline"}
                  messages={messages}
                  onModelChange={setCurrentModelId}
                  selectedModelId={currentModelId}
                  sendMessage={sendMessage}
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  showLandingPanels={isHomeState}
                  showSuggestedActions={false}
                  status={status}
                  stop={stop}
                  usage={usage}
                  workspaceSlug={workspaceSlug}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
