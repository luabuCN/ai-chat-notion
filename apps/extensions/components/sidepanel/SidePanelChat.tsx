import {
  Button,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { ArrowUp, BookOpen, Loader2, Plus, Square } from "lucide-react";
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
import { fetchSidepanelChatMessages } from "@/lib/sidepanel-history-api";

export function SidePanelChat({
  auth,
  workspaceSlug,
  workspaceLoading,
}: {
  auth: MainSiteAuthState;
  workspaceSlug: string;
  workspaceLoading: boolean;
}) {
  const { models, loading: modelsLoading, error: modelsError } =
    useExtensionModels();
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
    handleSend,
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

      <form className="shrink-0 bg-background p-2" onSubmit={onFormSubmit}>
        {!summarizeBannerDismissed ? (
          <div className="mb-2">
            <SummarizePageBanner
              isPlaceholder={summarizePageIsPlaceholder}
              onDismiss={() => {
                setSummarizeBannerDismissed(true);
              }}
              page={summarizePage}
            />
          </div>
        ) : null}
        <TooltipProvider>
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
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
            <div className="flex shrink-0 items-center gap-1">
              <SidePanelHistoryDrawer
                auth={auth}
                currentChatId={chatId}
                onSelectChat={async (targetChatId) => {
                  const historyMessages =
                    await fetchSidepanelChatMessages(targetChatId);
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
                  !input.trim() ||
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
