import {
  Button,
  ImagePreview,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import {
  ArrowUp,
  BookOpen,
  Crop,
  Loader2,
  Plus,
  Square,
  X,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ExtensionMessageList } from "@/components/sidepanel/extension-message-list";
import { SidePanelEmptyState } from "@/components/sidepanel/SidePanelEmptyState";
import { SidePanelHistoryDrawer } from "@/components/sidepanel/SidePanelHistoryDrawer";
import { SummarizePageBanner } from "@/components/sidepanel/SummarizePageBanner";
import { ModelSelectorBar } from "@/components/sidepanel/model-selector-bar";
import { ReasoningToggleBar } from "@/components/sidepanel/reasoning-toggle-bar";
import type { MainSiteAuthState } from "@/hooks/use-main-site-auth";
import {
  ACTIVE_TAB_PAGE_PLACEHOLDER,
  useActiveTabPageInfo,
} from "@/hooks/use-active-tab-page-info";
import { useExtensionModels } from "@/hooks/use-extension-models";
import { useSidepanelChat } from "@/hooks/use-sidepanel-chat";
import { dataUrlToFile } from "@/lib/data-url-to-file";
import { sendMessage } from "@/lib/messaging/extension-messaging";
import { fetchSidepanelChatMessages } from "@/lib/sidepanel-history-api";
import { uploadFileToMainSite } from "@/lib/upload-main-site-file";

export function SidePanelChat({
  auth,
  workspaceSlug,
  workspaceLoading,
}: {
  auth: MainSiteAuthState;
  workspaceSlug: string;
  workspaceLoading: boolean;
}) {
  const {
    models,
    loading: modelsLoading,
    error: modelsError,
  } = useExtensionModels();
  const { info: activeTabPage } = useActiveTabPageInfo();
  const summarizePage = activeTabPage ?? ACTIVE_TAB_PAGE_PLACEHOLDER;
  const summarizePageIsPlaceholder = activeTabPage === null;
  const [summarizeBannerDismissed, setSummarizeBannerDismissed] =
    useState(false);
  const authenticated = auth.data?.authenticated === true;

  const {
    chatId,
    messages,
    status,
    stop,
    error,
    input,
    setInput,
    pendingAttachment,
    setPendingAttachment,
    handleSend,
    handleSummarizePage,
    busy,
    selectedModelId,
    setSelectedModelId,
    enableReasoning,
    setEnableReasoning,
    supportsReasoning,
    selectedModel,
    restoreChat,
    resetToNewChat,
  } = useSidepanelChat(models, modelsLoading, workspaceSlug);

  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const prevWorkspaceSlugRef = useRef<string | null>(null);
  useEffect(() => {
    const slug = workspaceSlug.trim();
    if (!slug) {
      return;
    }
    if (
      prevWorkspaceSlugRef.current !== null &&
      prevWorkspaceSlugRef.current !== slug
    ) {
      resetToNewChat();
    }
    prevWorkspaceSlugRef.current = slug;
  }, [workspaceSlug, resetToNewChat]);

  const workspaceBlocksSend =
    authenticated && (workspaceLoading || !workspaceSlug.trim());

  const onFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!authenticated) {
      return;
    }
    handleSend();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) {
      return;
    }
    e.preventDefault();
    if (!authenticated) {
      return;
    }
    handleSend();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {messages.length === 0 ? (
        <SidePanelEmptyState auth={auth} />
      ) : (
        <ExtensionMessageList messages={messages} />
      )}

      {modelsError ? (
        <p className="shrink-0 px-2 pb-1 text-destructive text-xs">
          模型列表加载失败：{modelsError}
        </p>
      ) : null}
      {error ? (
        <p className="shrink-0 px-2 pb-1 text-destructive text-xs">
          {error.message}
        </p>
      ) : null}
      {captureError ? (
        <p className="shrink-0 px-2 pb-1 text-destructive text-xs">
          {captureError}
        </p>
      ) : null}

      <form className="shrink-0 bg-background p-2" onSubmit={onFormSubmit}>
        {!summarizeBannerDismissed ? (
          <div className="mb-2">
            <SummarizePageBanner
              isPlaceholder={summarizePageIsPlaceholder}
              onDismiss={() => {
                setSummarizeBannerDismissed(true);
              }}
              onSummarize={handleSummarizePage}
              page={summarizePage}
            />
          </div>
        ) : null}
        <TooltipProvider>
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <div className="flex items-center gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="总结网页"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSummarizeBannerDismissed(false);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    <BookOpen className="size-4" strokeWidth={2} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">总结网页</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="截取网页"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
                    disabled={
                      !authenticated || busy || captureBusy || modelsLoading
                    }
                    onClick={() => {
                      void (async () => {
                        if (!authenticated || busy || captureBusy) {
                          return;
                        }
                        setCaptureError(null);
                        setCaptureBusy(true);
                        try {
                          const result = await sendMessage("pageCapture");
                          if (!result.ok) {
                            if ("cancelled" in result && result.cancelled) {
                              return;
                            }
                            setCaptureError(
                              "error" in result ? result.error : "截取失败"
                            );
                            return;
                          }
                          const file = await dataUrlToFile(
                            result.dataUrl,
                            `page-capture-${Date.now()}.png`
                          );
                          const uploaded = await uploadFileToMainSite(file);
                          const mediaType =
                            uploaded.contentType === "image/jpeg"
                              ? ("image/jpeg" as const)
                              : ("image/png" as const);
                          setPendingAttachment({
                            url: uploaded.url,
                            name: uploaded.pathname,
                            mediaType,
                          });
                        } catch (e) {
                          setCaptureError(
                            e instanceof Error ? e.message : "截取或上传失败"
                          );
                        } finally {
                          setCaptureBusy(false);
                        }
                      })();
                    }}
                    type="button"
                    variant="ghost"
                  >
                    {captureBusy ? (
                      <Loader2
                        className="size-4 animate-spin"
                        strokeWidth={2}
                      />
                    ) : (
                      <Crop className="size-4" strokeWidth={2} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  截图
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <SidePanelHistoryDrawer
                auth={auth}
                currentChatId={chatId}
                onSelectChat={async (targetChatId) => {
                  const historyMessages = await fetchSidepanelChatMessages(
                    targetChatId
                  );
                  restoreChat(targetChatId, historyMessages);
                }}
                workspaceSlug={workspaceSlug}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="新建会话"
                    className="size-8 shrink-0 rounded-lg"
                    onClick={() => resetToNewChat()}
                    type="button"
                    variant="ghost"
                  >
                    <Plus className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">新建会话</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-background p-2 shadow-xs">
          {pendingAttachment ? (
            <div className="group relative inline-flex">
              <ImagePreview src={pendingAttachment.url}>
                <button
                  aria-label="查看截图"
                  className="relative flex size-20 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-border/50 bg-muted/50 p-0 aspect-square"
                  type="button"
                >
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={pendingAttachment.url}
                  />
                </button>
              </ImagePreview>
              <Button
                aria-label="移除截图"
                className="absolute top-[-5px] right-[-10px] z-10 size-6 rounded-full border border-border/60 bg-background/90 text-foreground shadow-sm backdrop-blur-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 pointer-coarse:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingAttachment(null);
                }}
                type="button"
                variant="secondary"
                size={'sm'}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : null}
          <Textarea
            className="min-h-[72px] resize-none rounded-xl border-none bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
            name="message"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="发送消息…"
            value={input}
          />
          <div className="flex items-center justify-between gap-1 pt-1">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <ModelSelectorBar
                models={models}
                modelsLoading={modelsLoading}
                onModelChange={setSelectedModelId}
                selectedModelId={selectedModelId}
              />
              <ReasoningToggleBar
                disabled={busy}
                enabled={enableReasoning}
                onToggle={setEnableReasoning}
                supportsReasoning={supportsReasoning}
              />
            </div>
            {busy ? (
              <Button
                aria-label={status === "submitted" ? "等待响应" : "停止生成"}
                className="size-9 shrink-0 rounded-full"
                onClick={() => void stop()}
                type="button"
                variant="default"
              >
                {status === "submitted" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Square className="size-4" />
                )}
              </Button>
            ) : (
              <Button
                aria-label="发送"
                className="size-9 shrink-0 rounded-full"
                disabled={
                  !authenticated ||
                  workspaceBlocksSend ||
                  (!input.trim() && !pendingAttachment) ||
                  modelsLoading ||
                  !selectedModel
                }
                type="submit"
              >
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
