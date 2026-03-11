"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { HistoryIcon, ImageIcon } from "lucide-react";
import { toast } from "@/components/toast";
import { useWorkspace } from "@/components/workspace-provider";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { MODELS, SIZES } from "./constants";
import { StudioHistoryPanel } from "./studio-history-panel";
import { StudioResultPanel } from "./studio-result-panel";
import { StudioSidebar } from "./studio-sidebar";
import { useImageGeneration, useImageHistory } from "./actions";
import type { HistoryItem, PromptOptions } from "./types";

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
  const [resultImage, setResultImage] = useState<string | null>(null);

  const {
    data: history = [],
    isLoading: isHistoryLoading,
    refetch: loadHistory,
  } = useImageHistory(workspaceSlug, historyScope);

  const { mutate: generateImage, isPending: isGenerating } =
    useImageGeneration();

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
    setPrompt((current) =>
      current.trim() ? `${current}，${template}` : template
    );
  }

  function selectHistoryItem(item: HistoryItem) {
    setActiveTab("result");
    if (item.outputImageUrl) {
      setResultImage(item.outputImageUrl);
    }
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
    setResultImage(null);
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

    setResultImage(null);
    setActiveTab("result");

    const promptAdditions = Object.entries(promptOptions)
      .filter(([key]) => key !== "negatives")
      .flatMap(([, values]) => values);

    const composedPrompt = [prompt.trim(), ...promptAdditions]
      .filter(Boolean)
      .join(", ");

    const composedNegative = [negativePrompt.trim(), ...promptOptions.negatives]
      .filter(Boolean)
      .join(", ");

    generateImage(
      {
        model,
        prompt: composedPrompt,
        negative_prompt: composedNegative,
        size,
        workspaceSlug,
        promptOptions,
      },
      {
        onSuccess: (imageUrl) => {
          setResultImage(imageUrl);
          toast({
            type: "success",
            description: "图片已生成并自动上传到素材库",
          });
          loadHistory();
        },
        onError: (error) => {
          toast({
            type: "error",
            description:
              error instanceof Error ? error.message : "图片生成失败",
          });
          loadHistory();
        },
      }
    );
  }

  return (
    <div className="h-dvh p-2 md:p-4">
      <div className="flex h-full min-h-0 overflow-hidden rounded-[28px] border border-zinc-200 bg-white text-zinc-950 shadow-sm">
        <StudioSidebar
          currentWorkspaceName={currentWorkspace?.name}
          role={role}
          permission={permission}
          model={model}
          prompt={prompt}
          negativePrompt={negativePrompt}
          size={size}
          promptOptions={promptOptions}
          isGenerating={isGenerating}
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
                <TabsTrigger value="result">
                  <ImageIcon />
                  {"生成结果"}
                </TabsTrigger>
                <TabsTrigger value="history">
                  <HistoryIcon />
                  {"历史记录"}
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
              />
            </TabsContent>

            <TabsContent
              value="history"
              className="mt-0 min-h-0 flex-1 overflow-hidden px-5 py-5 md:px-6"
            >
              <StudioHistoryPanel
                history={history}
                isHistoryLoading={isHistoryLoading}
                onSelectHistory={selectHistoryItem}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
