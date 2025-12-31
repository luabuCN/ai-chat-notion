import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@repo/database";
import type { ChatMessage } from "@/lib/types";
import { Action, Actions } from "./elements/actions";
import { CopyIcon, PencilEditIcon, ThumbDownIcon, ThumbUpIcon } from "./icons";
import { FilePlus, Loader2 } from "lucide-react";
import { DocumentSelectorDialog } from "./editor/document-selector-dialog";
import { useCreateDocument } from "@/hooks/use-document-query";
import { useParams, useRouter } from "next/navigation";
import { markdownToTiptap } from "@repo/editor";
import { useWorkspace } from "./workspace-provider";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMode,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const { currentWorkspace } = useWorkspace();
  const createMutation = useCreateDocument();

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  const handleGenerateDocument = () => {
    if (!textFromParts) {
      toast.error("没有可生成文档的内容");
      return;
    }
    setIsGenerateDialogOpen(true);
  };

  const onGenerate = async (parentDocumentId: string | null) => {
    try {
      const toastId = toast.loading("正在生成文档...");
      console.log(textFromParts, "textFromParts====");
      // Convert markdown to Tiptap JSON
      const content = markdownToTiptap(textFromParts || "");
      console.log(content, "content====");
      let title = "新文档";
      try {
        const chatRes = await fetch(`/api/chat/${chatId}/title`);
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (chatData.title) {
            title = chatData.title;
          }
        }
      } catch (e) {
        console.error("Failed to fetch chat title", e);
      }

      // Use first line as title or default if chat title is default or empty
      if (!title || title === "New Chat") {
        title = textFromParts?.split("\n")[0]?.slice(0, 20) || "新文档";
      }

      const newDoc = await createMutation.mutateAsync({
        title,
        parentDocumentId: parentDocumentId ?? undefined,
        workspaceId: currentWorkspace?.id,
      });

      // Update content
      await fetch(`/api/editor-documents/${newDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify(content) }),
      });

      toast.dismiss(toastId);
      toast.success("文档生成成功");
      setIsGenerateDialogOpen(false);
      router.push(`/${workspaceSlug}/editor/${newDoc.id}`);
    } catch (error) {
      toast.dismiss();
      toast.error("生成文档失败");
      console.error(error);
    }
  };

  // User messages get edit (on hover) and copy actions
  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end">
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
        <Action onClick={handleCopy} tooltip="Copy">
          <CopyIcon />
        </Action>

        <Action onClick={handleGenerateDocument} tooltip="生成文档">
          {createMutation.isPending ? (
            <Loader2 className="animate-spin h-4 w-4" />
          ) : (
            <FilePlus className="h-4 w-4" />
          )}
        </Action>

        <Action
          data-testid="message-upvote"
          disabled={vote?.isUpvoted}
          onClick={() => {
            const upvote = fetch("/api/vote", {
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
            const downvote = fetch("/api/vote", {
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

      <DocumentSelectorDialog
        open={isGenerateDialogOpen}
        onOpenChange={setIsGenerateDialogOpen}
        onSelect={onGenerate}
        isLoading={createMutation.isPending}
        title="生成文档"
        placeholder="选择保存位置..."
      />
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

    return true;
  }
);
