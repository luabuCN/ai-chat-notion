import equal from "fast-deep-equal";
import dynamic from "next/dynamic";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@repo/database";
import type { ChatMessage, MessageMetadata } from "@/lib/types";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui";
import { Action, Actions } from "./elements/actions";
import { Response } from "./elements/response";
import {
  CopyIcon,
  FullscreenIcon,
  PencilEditIcon,
  ThumbDownIcon,
  ThumbUpIcon,
} from "./icons";
import { FilePlus, Loader2 } from "lucide-react";
import { DocumentSelectorDialog } from "./editor/document-selector-dialog";
import { useGenerateTiptapDocument } from "@/hooks/use-generate-tiptap-document";
import {
  fetchArtifactDocumentContent,
  findCreatedDocumentInMessages,
} from "@/lib/artifact-document-source";
import { apiFetch } from "@/lib/api-client";

const OpenUiMessageRenderer = dynamic(
  () =>
    import("./openui-message-renderer").then(
      (mod) => mod.OpenUiMessageRenderer
    ),
  { ssr: false }
);

export function PureMessageActions({
  chatId,
  message,
  messages,
  vote,
  isLoading,
  setMode,
}: {
  chatId: string;
  message: ChatMessage;
  messages: ChatMessage[];
  vote: Vote | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [isResolvingSource, setIsResolvingSource] = useState(false);
  const [isOpenUiFullscreenOpen, setIsOpenUiFullscreenOpen] = useState(false);
  const {
    isDialogOpen,
    setIsDialogOpen,
    isGenerating,
    openGenerateDialog,
    handleGenerate,
  } = useGenerateTiptapDocument();

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  const metadata = message.metadata as MessageMetadata | undefined;
  const isOpenUiMessage =
    message.role === "assistant" && metadata?.renderMode === "openui";

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  const resolveGenerateSource = async (): Promise<{
    title: string;
    markdown: string;
  } | null> => {
    const createdDocument = findCreatedDocumentInMessages(messages);

    if (createdDocument) {
      const content = await fetchArtifactDocumentContent(createdDocument.id);
      if (content?.trim()) {
        return {
          title: createdDocument.title,
          markdown: content,
        };
      }
    }

    if (!textFromParts) {
      return null;
    }

    let title = "新文档";
    try {
      const chatRes = await apiFetch(`/api/chat/${chatId}/title`);
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        if (chatData.title) {
          title = chatData.title;
        }
      }
    } catch (error) {
      console.error("Failed to fetch chat title", error);
    }

    if (!title || title === "New Chat") {
      title = textFromParts.split("\n")[0]?.slice(0, 20) || "新文档";
    }

    return {
      title,
      markdown: textFromParts,
    };
  };

  const handleGenerateDocument = async () => {
    setIsResolvingSource(true);

    try {
      const source = await resolveGenerateSource();
      if (!source) {
        toast.error("没有可生成文档的内容");
        return;
      }

      openGenerateDialog(source.title, source.markdown);
    } finally {
      setIsResolvingSource(false);
    }
  };

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end mt-1">
        <div className="relative">
          {setMode && (
            <Action
              className="-left-10 absolute top-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/message:opacity-100"
              data-testid="message-edit-button"
              onClick={() => setMode("edit")}
              tooltip="Edit"
            >
              <PencilEditIcon />
            </Action>
          )}
          <Action onClick={handleCopy} tooltip="Copy">
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <>
      <Actions className="-ml-0.5">
        {isOpenUiMessage ? (
          <Action
            onClick={() => setIsOpenUiFullscreenOpen(true)}
            tooltip="全屏展示"
          >
            <FullscreenIcon />
          </Action>
        ) : (
          <>
            <Action onClick={handleCopy} tooltip="Copy">
              <CopyIcon />
            </Action>

            <Action
              onClick={handleGenerateDocument}
              tooltip="生成文档"
              disabled={isResolvingSource || isGenerating}
            >
              {isResolvingSource || isGenerating ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <FilePlus className="h-4 w-4" />
              )}
            </Action>
          </>
        )}

        <Action
          data-testid="message-upvote"
          disabled={vote?.isUpvoted}
          onClick={() => {
            const upvote = apiFetch("/api/vote", {
              method: "PATCH",
              body: JSON.stringify({
                chatId,
                messageId: message.id,
                type: "up",
              }),
            });

            toast.promise(upvote, {
              loading: "Upvoting Response...",
              success: () => {
                mutate<Vote[]>(
                  `/api/vote?chatId=${chatId}`,
                  (currentVotes) => {
                    if (!currentVotes) {
                      return [];
                    }

                    const votesWithoutCurrent = currentVotes.filter(
                      (currentVote) => currentVote.messageId !== message.id
                    );

                    return [
                      ...votesWithoutCurrent,
                      {
                        chatId,
                        messageId: message.id,
                        isUpvoted: true,
                      },
                    ];
                  },
                  { revalidate: false }
                );

                return "Upvoted Response!";
              },
              error: "Failed to upvote response.",
            });
          }}
          tooltip="Upvote Response"
        >
          <ThumbUpIcon />
        </Action>

        <Action
          data-testid="message-downvote"
          disabled={vote && !vote.isUpvoted}
          onClick={() => {
            const downvote = apiFetch("/api/vote", {
              method: "PATCH",
              body: JSON.stringify({
                chatId,
                messageId: message.id,
                type: "down",
              }),
            });

            toast.promise(downvote, {
              loading: "Downvoting Response...",
              success: () => {
                mutate<Vote[]>(
                  `/api/vote?chatId=${chatId}`,
                  (currentVotes) => {
                    if (!currentVotes) {
                      return [];
                    }

                    const votesWithoutCurrent = currentVotes.filter(
                      (currentVote) => currentVote.messageId !== message.id
                    );

                    return [
                      ...votesWithoutCurrent,
                      {
                        chatId,
                        messageId: message.id,
                        isUpvoted: false,
                      },
                    ];
                  },
                  { revalidate: false }
                );

                return "Downvoted Response!";
              },
              error: "Failed to downvote response.",
            });
          }}
          tooltip="Downvote Response"
        >
          <ThumbDownIcon />
        </Action>
      </Actions>

      {!isOpenUiMessage && (
        <DocumentSelectorDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSelect={handleGenerate}
          isLoading={isGenerating}
          title="生成文档"
          placeholder="选择保存位置..."
        />
      )}

      <Dialog
        open={isOpenUiFullscreenOpen}
        onOpenChange={setIsOpenUiFullscreenOpen}
      >
        <DialogContent className="h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogTitle className="sr-only">全屏展示</DialogTitle>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="border-b px-4 py-3">
              <div className="font-medium text-sm">全屏展示</div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4 md:px-8 md:py-6">
              <div className="mx-auto w-full max-w-6xl">
                <OpenUiMessageRenderer
                  fallback={
                    <Response className="[&_ol]:list-decimal [&_ul]:list-disc [&_ol]:pl-5 [&_ul]:pl-5">
                      {textFromParts}
                    </Response>
                  }
                  isStreaming={false}
                  text={textFromParts}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (!equal(prevProps.messages, nextProps.messages)) {
      return false;
    }

    return true;
  }
);
