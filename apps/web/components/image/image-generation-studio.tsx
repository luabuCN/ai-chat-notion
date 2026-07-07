"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { HistoryIcon, ImageIcon } from "lucide-react";
import { toast } from "@/components/toast";
import { useWorkspace } from "@/components/workspace-provider";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { MODELS, SIZES } from "./constants";
import { StudioHistoryPanel } from "./studio-history-panel";
import { StudioResultPanel } from "./studio-result-panel";
import { StudioSidebar } from "./studio-sidebar";
import {
  useCreateImageGenerationTask,
  useDeleteImageHistory,
  useImageHistory,
} from "./actions";
import type { HistoryItem, PromptOptions } from "./types";
import {
  completeImageGenerationTask,
  failImageGenerationTask,
  removeImageGenerationTask,
  setActiveImageGenerationTask,
  useActiveImageGenerationTask,
  usePendingImageGenerationCount,
} from "@/lib/image-generation/generation-store";
import { cancelBackgroundImagePoll } from "@/lib/image-generation/generation-runner";

type ResultView =
  | { type: "empty" }
  | { type: "generating" }
  | { type: "success"; imageUrl: string }
  | {
      type: "failed";
      historyId: string;
      error: string;
      providerTaskId?: string | null;
    };

export function ImageGenerationStudio({
  workspaceSlug,
}: {
  workspaceSlug?: string;
}) {
  const { currentWorkspace } = useWorkspace();
  const { role, permission, canCreate } = useWorkspacePermission();
  const historyScope = useMemo<"workspace" | "user">(
    () => (workspaceSlug ? "workspace" : "user"),
    [workspaceSlug]
  );

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [size, setSize] = useState(SIZES[0].id);
  const [activeTab, setActiveTab] = useState("result");
  const [promptOptions, setPromptOptions] = useState<PromptOptions>({
    styles: [],
    scenes: [],
    lighting: [],
    camera: [],
    quality: [],
    negatives: [],
  });
  const [resultView, setResultView] = useState<ResultView>({ type: "empty" });
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(
    null
  );
  const [pausingTaskId, setPausingTaskId] = useState<string | null>(null);

  const pendingCount = usePendingImageGenerationCount();
  const activeTask = useActiveImageGenerationTask();

  const {
    data: history = [],
    isLoading: isHistoryLoading,
    refetch: loadHistory,
  } = useImageHistory(workspaceSlug, historyScope, {
    refetchPending: pendingCount > 0,
  });

  const { mutate: createImageTask, isPending: isSubmitting } =
    useCreateImageGenerationTask();
  const { mutate: deleteImageHistory } = useDeleteImageHistory();

  const resultImage =
    resultView.type === "success" ? resultView.imageUrl : null;
  const failedError =
    resultView.type === "failed" ? resultView.error : null;
  const isGenerating =
    resultView.type === "generating" &&
    (activeTask?.status === "pending" ||
      activeTask?.status === "processing" ||
      !activeTask);

  useEffect(() => {
    for (const item of history) {
      if (!item.providerTaskId) {
        continue;
      }

      if (item.status === "FAILED") {
        failImageGenerationTask(
          item.providerTaskId,
          item.errorMessage || "图片生成失败"
        );
      } else if (item.status === "SUCCEED" && item.outputImageUrl) {
        completeImageGenerationTask(
          item.providerTaskId,
          item.outputImageUrl
        );
      }
    }
  }, [history]);

  useEffect(() => {
    if (activeTask?.status === "completed") {
      setResultView({
        type: "success",
        imageUrl: activeTask.outputImageUrl ?? "",
      });
      void loadHistory();
    }

    if (activeTask?.status === "failed" && resultView.type === "generating") {
      const historyItem = history.find(
        (item) => item.providerTaskId === activeTask.taskId
      );
      setResultView({
        type: "failed",
        historyId: historyItem?.id ?? "",
        error: activeTask.error || "图片生成失败",
        providerTaskId: activeTask.taskId,
      });
      void loadHistory();
    }
  }, [
    activeTask?.status,
    activeTask?.outputImageUrl,
    activeTask?.error,
    activeTask?.taskId,
    history,
    loadHistory,
    resultView.type,
  ]);

  function togglePromptOption(
    group: keyof PromptOptions,
    value: string,
    target: "prompt" | "negative" = "prompt"
  ) {
    setPromptOptions((current) => {
      const exists = current[group].includes(value);
      return {
        ...current,
        [group]: exists ? [] : [value],
      };
    });
  }

  function applyTemplate(template: string) {
    setPrompt("");
    setPrompt((current) =>
      current.trim() ? `${current}，${template}` : template
    );
  }

  function handlePauseGeneration(item: HistoryItem) {
    if (!item.providerTaskId) {
      return;
    }

    setPausingTaskId(item.providerTaskId);
    cancelBackgroundImagePoll(item.providerTaskId);
    toast({
      type: "success",
      description: "已暂停该任务的后台跟踪",
    });
    setPausingTaskId(null);
  }

  function handleDeleteHistory(item: HistoryItem) {
    setDeletingHistoryId(item.id);
    deleteImageHistory(item.id, {
      onSuccess: () => {
        if (item.providerTaskId) {
          removeImageGenerationTask(item.providerTaskId);
        }
        if (resultView.type === "failed" && resultView.historyId === item.id) {
          setResultView({ type: "empty" });
        }
        toast({ type: "success", description: "已删除生成记录" });
        void loadHistory();
      },
      onError: (error) => {
        toast({
          type: "error",
          description:
            error instanceof Error ? error.message : "删除失败",
        });
      },
      onSettled: () => {
        setDeletingHistoryId(null);
      },
    });
  }

  function handleReset() {
    setPrompt("");
    setNegativePrompt("");
    setModel(MODELS[0].id);
    setSize(SIZES[0].id);
    setPromptOptions({
      styles: [],
      scenes: [],
      lighting: [],
      camera: [],
      quality: [],
      negatives: [],
    });
    setResultView({ type: "empty" });
    setActiveImageGenerationTask(null);
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast({ type: "error", description: "请输入图片描述后再开始创作" });
      return;
    }

    if (!canCreate) {
      toast({
        type: "error",
        description: "当前空间为只读权限，暂时不能创建图片",
      });
      return;
    }

    setActiveTab("result");
    setResultView({ type: "generating" });

    const promptAdditions = Object.entries(promptOptions)
      .filter(([key]) => key !== "negatives")
      .flatMap(([, values]) => values);

    const composedPrompt = [prompt.trim(), ...promptAdditions]
      .filter(Boolean)
      .join(", ");

    const composedNegative = [negativePrompt.trim(), ...promptOptions.negatives]
      .filter(Boolean)
      .join(", ");

    createImageTask(
      {
        model,
        prompt: composedPrompt,
        negative_prompt: composedNegative,
        size,
        workspaceSlug,
        promptOptions,
      },
      {
        onSuccess: () => {
          toast({
            type: "success",
            description: "已提交生成任务，可继续创作或切换页面",
          });
          void loadHistory();
        },
        onError: (error) => {
          setResultView({ type: "empty" });
          toast({
            type: "error",
            description:
              error instanceof Error ? error.message : "图片生成失败",
          });
        },
      }
    );
  }

  return (
    <div className="h-dvh">
      <div className="flex h-full min-h-0 overflow-hidden rounded-[28px]  border-zinc-200 bg-white text-zinc-950">
        <StudioSidebar
          currentWorkspaceName={currentWorkspace?.name}
          role={role}
          permission={permission}
          model={model}
          prompt={prompt}
          negativePrompt={negativePrompt}
          size={size}
          promptOptions={promptOptions}
          isGenerating={isSubmitting}
          pendingCount={pendingCount}
          canCreate={canCreate}
          onModelChange={setModel}
          onPromptChange={setPrompt}
          onNegativePromptChange={setNegativePrompt}
          onSizeChange={setSize}
          onTogglePromptOption={togglePromptOption}
          onApplyTemplate={applyTemplate}
          onGenerate={handleGenerate}
          onReset={handleReset}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="px-5 py-4 md:px-6">
              <TabsList>
                <TabsTrigger value="result" className="py-1">
                  <ImageIcon />
                  生成结果
                </TabsTrigger>
                <TabsTrigger value="history" className="py-1">
                  <HistoryIcon />
                  历史记录
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="result"
              className="mt-0 min-h-0 flex-1 overflow-hidden px-5 py-5 md:px-6"
            >
              <StudioResultPanel
                resultImage={resultImage}
                isGenerating={isGenerating}
                progressMessage={activeTask?.progress}
                failedError={failedError}
                isDeleting={
                  resultView.type === "failed" &&
                  deletingHistoryId === resultView.historyId
                }
                onDeleteFailed={
                  resultView.type === "failed" && resultView.historyId
                    ? () => {
                        const item = history.find(
                          (entry) => entry.id === resultView.historyId
                        );
                        if (item) {
                          handleDeleteHistory(item);
                        }
                      }
                    : undefined
                }
              />
            </TabsContent>

            <TabsContent
              value="history"
              className="mt-0 min-h-0 flex-1 overflow-hidden px-5 py-5 md:px-6"
            >
              <StudioHistoryPanel
                history={history}
                isHistoryLoading={isHistoryLoading}
                onDeleteHistory={handleDeleteHistory}
                onPauseGeneration={handlePauseGeneration}
                deletingHistoryId={deletingHistoryId}
                pausingTaskId={pausingTaskId}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
