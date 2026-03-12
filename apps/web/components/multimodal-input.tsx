"use client";

import type { UseChatHelpers } from "@ai-sdk/react";

import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { saveChatModelAsCookie } from "@/app/(workbench)/chat/actions";
import { SelectItem } from "@repo/ui";

import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";
import { useModels } from "@/hooks/use-models";
import type { ModelInfo } from "@/app/api/models/route";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectTrigger,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import { ArrowUpIcon, CpuIcon, PaperclipIcon, StopIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { SuggestedActions } from "./suggested-actions";
import { ContextSelector, type SelectedDocument } from "./context-selector";
import { Button } from "@repo/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { Brain, Image, Video, XIcon } from "lucide-react";

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedModelId,
  onModelChange,
  usage,
  workspaceSlug,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
  workspaceSlug?: string;
}) {
  const [enableReasoning, setEnableReasoning] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<
    SelectedDocument[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const { models, loading: modelsLoading } = useModels();

  // Auto-select first model if selectedModelId is not in the models list
  useEffect(() => {
    if (!modelsLoading && models.length > 0) {
      const isSelectedModelValid = models.some(
        (model) => model.full_slug === selectedModelId
      );
      if (!isSelectedModelValid) {
        // Select first model if current selection is invalid
        const firstModel = models[0];
        if (firstModel && onModelChange) {
          onModelChange(firstModel.full_slug);
          startTransition(() => {
            saveChatModelAsCookie(firstModel.full_slug);
          });
        }
      }
    }
  }, [models, modelsLoading, selectedModelId, onModelChange]);

  // Check if the selected model supports reasoning
  const selectedModel = useMemo(() => {
    return models.find((model) => model.full_slug === selectedModelId);
  }, [models, selectedModelId]);

  const supportsReasoning = useMemo(() => {
    return selectedModel?.supports_reasoning ?? false;
  }, [selectedModel]);

  const supportsFileInput = useMemo(() => {
    // The current upload flow is mainly multimodal-oriented.
    // Gate it by provider-declared image/video input capabilities.
    return Boolean(
      selectedModel?.supports_image_in || selectedModel?.supports_video_in
    );
  }, [selectedModel]);

  // Reset reasoning when model changes and doesn't support it
  useEffect(() => {
    if (!supportsReasoning && enableReasoning) {
      setEnableReasoning(false);
    }
  }, [supportsReasoning, enableReasoning]);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  // 切换选中/取消选中文档
  const handleDocumentSelect = useCallback((doc: SelectedDocument) => {
    setSelectedDocuments((prev) => {
      const exists = prev.find((d) => d.id === doc.id);
      if (exists) return prev.filter((d) => d.id !== doc.id);
      return [...prev, doc];
    });
  }, []);

  // 移除已选文档
  const handleDocumentRemove = useCallback((docId: string) => {
    setSelectedDocuments((prev) => prev.filter((d) => d.id !== docId));
  }, []);

  const submitForm = useCallback(() => {
    window.history.pushState({}, "", `/${workspaceSlug}/chat/${chatId}`);

    // 区分多媒体附件和文档附件
    // 图片/视频可以作为 file part 直接发送给模型
    // 其他类型（PDF、Word 等）当前模型 API 不支持 file part，跳过
    const mediaAttachments = attachments.filter(
      (a) =>
        a.contentType?.startsWith("image/") ||
        a.contentType?.startsWith("video/")
    );
    const skippedAttachments = attachments.filter(
      (a) =>
        !a.contentType?.startsWith("image/") &&
        !a.contentType?.startsWith("video/")
    );

    if (skippedAttachments.length > 0) {
      toast.warning(
        `${skippedAttachments
          .map((a) => a.name)
          .join(", ")} 暂不支持作为附件发送，仅支持图片和视频文件`
      );
    }

    sendMessage(
      {
        role: "user",
        parts: [
          ...mediaAttachments.map((attachment) => ({
            type: "file" as const,
            url: attachment.url,
            name: attachment.name,
            mediaType: attachment.contentType,
          })),
          {
            type: "text",
            text: input,
          },
        ],
        // 传递引用文档元信息，用于消息 UI 即时显示
        ...(selectedDocuments.length > 0
          ? {
              metadata: {
                createdAt: new Date().toISOString(),
                documentRefs: selectedDocuments.map((d) => ({
                  id: d.id,
                  title: d.title,
                  icon: d.icon,
                })),
              },
            }
          : {}),
      },
      {
        body: {
          enableReasoning: enableReasoning && supportsReasoning,
          modelCapabilities: {
            supports_image_in: selectedModel?.supports_image_in ?? false,
            supports_video_in: selectedModel?.supports_video_in ?? false,
            supports_reasoning: selectedModel?.supports_reasoning ?? false,
          },
          documentIds: selectedDocuments.map((d) => d.id),
        },
      }
    );

    setAttachments([]);
    setSelectedDocuments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
    enableReasoning,
    supportsReasoning,
    supportsFileInput,
    selectedModel,
    workspaceSlug,
    selectedDocuments,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Upload successful", data);

        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("Failed to upload file, please try again!");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      const supportedFiles = files.filter(
        (file) =>
          file.type.startsWith("image/") || file.type.startsWith("video/")
      );
      const unsupportedFiles = files.filter(
        (file) =>
          !file.type.startsWith("image/") && !file.type.startsWith("video/")
      );

      if (unsupportedFiles.length > 0) {
        toast.error(
          `仅支持图片和视频格式，已忽略 ${unsupportedFiles.length} 个不支持的文件`
        );
      }

      if (supportedFiles.length === 0) {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        return;
      }

      setUploadQueue(supportedFiles.map((file) => file.name));

      try {
        const uploadPromises = supportedFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      if (!supportsFileInput) return;

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) return;

      // Prevent default paste behavior for images
      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems.map(async (item) => {
          const file = item.getAsFile();
          if (!file) return;
          return uploadFile(file);
        });

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch (error) {
        console.error("Error uploading pasted images:", error);
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, supportsFileInput]
  );

  // Add paste event listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            chatId={chatId}
            workspaceSlug={workspaceSlug}
            sendMessage={sendMessage}
          />
        )}

      <input
        accept="image/*,video/*"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <PromptInput
        className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status == "streaming") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}

        {/* 已引用文档标签 */}
        {selectedDocuments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-2 pt-1">
            {selectedDocuments.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground"
              >
                {doc.icon && <span>{doc.icon}</span>}
                <span className="max-w-[150px] truncate">{doc.title}</span>
                <button
                  className="ml-0.5 rounded-sm opacity-70 transition-opacity hover:opacity-100"
                  onClick={() => handleDocumentRemove(doc.id)}
                  type="button"
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={true}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder="Send a message..."
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
          {/* <Context {...contextProps} /> */}
        </div>
        <PromptInputToolbar className="border-top-0! border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              supportsFileInput={supportsFileInput}
              status={status}
            />
            <ContextSelector
              onSelect={handleDocumentSelect}
              selectedDocIds={selectedDocuments.map((d) => d.id)}
              disabled={status !== "ready"}
            />
            <ReasoningToggle
              enabled={enableReasoning}
              onToggle={setEnableReasoning}
              supportsReasoning={supportsReasoning}
              status={status}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
              models={models}
              modelsLoading={modelsLoading}
            />
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
              data-testid="send-button"
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  supportsFileInput,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  supportsFileInput: boolean;
}) {
  return (
    <Button
      className="aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || !supportsFileInput}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureReasoningToggle({
  enabled,
  onToggle,
  supportsReasoning,
  status,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  supportsReasoning: boolean;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const isDisabled = status !== "ready" || !supportsReasoning;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={isDisabled ? 0 : -1}>
            <Button
              className={cn(
                "aspect-square h-8 rounded-lg p-1 transition-colors",
                enabled && supportsReasoning
                  ? "bg-accent text-accent-foreground hover:bg-accent/80"
                  : "hover:bg-accent"
              )}
              data-testid="reasoning-toggle"
              disabled={isDisabled}
              onClick={(event) => {
                event.preventDefault();
                if (!isDisabled) {
                  onToggle(!enabled);
                }
              }}
              variant="ghost"
            >
              <Brain />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {supportsReasoning
            ? enabled
              ? "深度思考已启用"
              : "启用深度思考"
            : "当前模型不支持深度思考"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const ReasoningToggle = memo(PureReasoningToggle);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
  models,
  modelsLoading,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  models: ModelInfo[];
  modelsLoading: boolean;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  // Find selected model from dynamic models, or use first model if none selected
  const selectedDynamicModel =
    models.find((model) => model.full_slug === optimisticModelId) ||
    (models.length > 0 ? models[0] : undefined);

  const displayName = selectedDynamicModel
    ? `${selectedDynamicModel.model}`
    : "Select Model";

  return (
    <PromptInputModelSelect
      onValueChange={(modelSlug) => {
        const dynamicModel = models.find((m) => m.full_slug === modelSlug);
        if (dynamicModel) {
          setOptimisticModelId(dynamicModel.full_slug);
          onModelChange?.(dynamicModel.full_slug);
          startTransition(() => {
            saveChatModelAsCookie(dynamicModel.full_slug);
          });
        }
      }}
      value={selectedDynamicModel?.full_slug}
    >
      <PromptInputModelSelectTrigger
        className="h-8 px-2"
        disabled={modelsLoading}
      >
        <CpuIcon size={16} />
        <span className="hidden font-medium text-xs sm:block ml-1">
          {modelsLoading ? "Loading..." : displayName}
        </span>
      </PromptInputModelSelectTrigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px max-h-[400px] overflow-y-auto">
          {modelsLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Loading models...
            </div>
          ) : models.length > 0 ? (
            <>
              <div className="px-2 py-1.5 font-semibold text-[10px] text-muted-foreground uppercase">
                Available Models
              </div>
              {[...models]
                .sort((a, b) => a.model.localeCompare(b.model))
                .map((model) => (
                  <SelectItem key={model.full_slug} value={model.full_slug}>
                    <div className="truncate font-medium text-xs">
                      {model.model}
                    </div>
                    <div className="mt-px flex flex-wrap items-center gap-1 text-[10px] leading-tight">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm px-1.5 py-0.5",
                          model.supports_image_in
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground opacity-50"
                        )}
                        title={
                          model.supports_image_in
                            ? "支持图像输入"
                            : "不支持图像输入"
                        }
                      >
                        <Image size={12} />
                        <span className="sr-only">图像输入</span>
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm px-1.5 py-0.5",
                          model.supports_video_in
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground opacity-50"
                        )}
                        title={
                          model.supports_video_in
                            ? "支持视频输入"
                            : "不支持视频输入"
                        }
                      >
                        <Video size={12} />
                        <span className="sr-only">视频输入</span>
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-sm px-1.5 py-0.5",
                          model.supports_reasoning
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground opacity-50"
                        )}
                        title={
                          model.supports_reasoning
                            ? "支持深度思考"
                            : "不支持深度思考"
                        }
                      >
                        <Brain size={12} />
                        <span className="sr-only">深度思考</span>
                      </span>
                    </div>
                  </SelectItem>
                ))}
            </>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No models available
            </div>
          )}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
