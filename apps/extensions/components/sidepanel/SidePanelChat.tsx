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
  BookmarkPlus,
  Crop,
  Loader2,
  Paperclip,
  Plus,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  extractReadabilityFromTab,
} from "@/lib/extract-readability-from-tab";
import { sendMessage } from "@/lib/messaging/extension-messaging";
import { fetchSidepanelChatMessages } from "@/lib/sidepanel-history-api";
import { streamMainSitePost } from "@/lib/auth/stream-main-site";
import { uploadFileToMainSite } from "@/lib/upload-main-site-file";
import { WEB_ORIGIN } from "@/lib/web-config";
import { webFetchWithMainSiteCookies } from "@/lib/web-fetch";
import { markdownToTiptap } from "@repo/editor/converter";

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
  const [uploadBusy, setUploadBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="上传附件"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
                    disabled={!authenticated || busy || uploadBusy || modelsLoading}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="ghost"
                  >
                    {uploadBusy ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                    ) : (
                      <Paperclip className="size-4" strokeWidth={2} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  上传附件
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="保存到知识库"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
                    disabled={!authenticated || saveBusy || modelsLoading || !activeTabPage?.tabId}
                    onClick={() => {
                      const tabId = activeTabPage?.tabId;
                      if (!tabId) return;
                      void (async () => {
                        setSaveBusy(true);
                        try {
                          const result = await extractReadabilityFromTab(tabId);
                          if (!result.ok) {
                            toast.error(result.error ?? "提取页面内容失败");
                          } else if (result.article?.textContent) {
                            // 调用 AI 将内容转为 markdown
                            const markdown = await convertToMarkdown(
                              result.article.content ?? "",
                            );
                            const { id: savedDocId } = await saveToKnowledgeBase(
                              markdown,
                              activeTabPage.title ?? "未命名页面",
                              workspaceSlug,
                              activeTabPage.url ?? "",
                            );
                            const docUrl = editorDocumentUrl(
                              workspaceSlug,
                              savedDocId,
                            );
                            toast.success("已保存到知识库", {
                              action: {
                                label: "打开文档",
                                onClick: () => {
                                  void browser.tabs.create({ url: docUrl });
                                },
                              },
                              duration: 8000,
                            });
                          }
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "保存失败");
                        } finally {
                          setSaveBusy(false);
                        }
                      })();
                    }}
                    type="button"
                    variant="ghost"
                  >
                    {saveBusy ? (
                      <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                    ) : (
                      <BookmarkPlus className="size-4" strokeWidth={2} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  保存到知识库
                </TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                className="hidden"
                accept="image/png,image/jpeg,image/jpg,text/plain,text/markdown,.pdf,.doc,.docx"
                multiple
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  setUploadBusy(true);
                  try {
                    for (const file of files) {
                      const uploaded = await uploadFileToMainSite(file);
                      const mediaType =
                        uploaded.contentType === "image/jpeg"
                          ? ("image/jpeg" as const)
                          : uploaded.contentType === "image/png"
                            ? ("image/png" as const)
                            : ("image/png" as const);
                      setPendingAttachment({
                        url: uploaded.url,
                        name: uploaded.pathname,
                        mediaType,
                      });
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "上传失败");
                  } finally {
                    setUploadBusy(false);
                    e.target.value = "";
                  }
                }}
                type="file"
              />
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

/**
 * 调用 AI 将网页文本内容转换为 Markdown 格式
 */
async function convertToMarkdown(
  textContent: string,
): Promise<string> {
  const prompt = `你是一个网页 HTML 转 Markdown 的转换器，必须严格遵守以下规则：

**标题规则：**
- 禁止使用一级标题（#），输出中绝对不能出现 "# " 开头的标题
- 只能使用 ## 和 ### 作为标题标记
- 根据原始 HTML 的 h2、h3 标签转换，如果没有明确标题层级，使用 ## 作为最外层

**图片规则（最重要）：**
- 原文中出现的所有 <img> 标签，无论出现在哪里（文章开头、正文文字之前、段落中间、div 内部），都必须无一例外地转换为 ![描述](src) 输出
- 特别注意：如果原文第一行就是图片，你的输出第一行也必须是这个图片的 Markdown，不能从文字开始
- 图片是内容的一部分，绝对不能省略、跳过或删除任何图片
- 即使图片没有 alt 属性，也要输出 ![图片](src)

**内容还原规则：**
- 严格一比一还原原文结构，按原文顺序逐段转换，不要重新组织或省略任何段落
- 保留列表、代码块、表格等结构
- 只删除明显的广告、导航栏、页脚等与正文无关的部分，其余内容必须保留

把下方 HTML 内容逐段转换为 Markdown，严格按原文顺序输出，不要遗漏任何段落或图片。
内容：${textContent}`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      stream: true,
      prompt,
    });

    let result = "";

    const { done } = streamMainSitePost(
      "/api/ai/openai",
      body,
      (delta) => {
        result += delta;
      },
    );

    done
      .then((res) => {
        if (!res.ok) {
          reject(new Error(res.error ?? "AI 转换失败"));
        } else {
          resolve(result.trim());
        }
      })
      .catch((e) => {
        reject(e instanceof Error ? e : new Error("AI 转换失败"));
      });
  });
}

/** 与主站 `pdf-actions` 编辑器路径一致：有空间 slug 则 `/{slug}/editor/{id}`，否则 `/editor/{id}` */
function editorDocumentUrl(workspaceSlug: string, documentId: string): string {
  const base = WEB_ORIGIN.replace(/\/$/, "");
  const slug = workspaceSlug.trim();
  if (slug) {
    return `${base}/${slug}/editor/${documentId}`;
  }
  return `${base}/editor/${documentId}`;
}

/**
 * 保存 Markdown 内容到知识库。
 * 客户端通过 @repo/editor/converter 将 markdown 转为 Tiptap JSON，
 * 参考 /api/chat 的兼容改造：传 workspaceSlug 由服务端解析为 workspaceId。
 */
async function saveToKnowledgeBase(
  markdown: string,
  title: string,
  workspaceSlug: string,
  pageUrl: string,
): Promise<{ id: string }> {
  const doc = markdownToTiptap(markdown);
  const content = JSON.stringify(doc);
  const trimmedPageUrl = pageUrl.trim();

  const response = await webFetchWithMainSiteCookies(
    `${WEB_ORIGIN}/api/editor-documents`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        workspaceSlug,
        ...(trimmedPageUrl.length > 0
          ? { sourcePageUrl: trimmedPageUrl }
          : {}),
      }),
    },
  );

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string;
      cause?: string;
    };
    throw new Error(errorData.message ?? errorData.cause ?? "保存失败");
  }

  const created = (await response.json()) as { id?: string };
  if (!created.id) {
    throw new Error("保存成功但未返回文档 ID");
  }
  return { id: created.id };
}
