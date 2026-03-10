"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { HistoryIcon, ImageIcon } from "lucide-react";
import { toast } from "@/components/toast";
import { useWorkspace } from "@/components/workspace-provider";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { MODELS, SIZES } from "./image/constants";
import { StudioHistoryPanel } from "./image/studio-history-panel";
import { StudioResultPanel } from "./image/studio-result-panel";
import { StudioSidebar } from "./image/studio-sidebar";
import type { HistoryItem, PromptOptions } from "./image/types";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoadFailed, setHistoryLoadFailed] = useState(false);

  async function loadHistory(scope = historyScope) {
    setIsHistoryLoading(true);
    setHistoryLoadFailed(false);

    try {
      const params = new URLSearchParams({ scope, limit: "30" });
      if (workspaceSlug) {
        params.set("workspace", workspaceSlug);
      }

      const response = await fetch(`/api/image/history?${params.toString()}`);
      if (!response.ok) {
        throw new Error("加载历史记录失败");
      }

      const data = await response.json();
      startTransition(() => {
        setHistory(data.items || []);
      });
    } catch (error) {
      console.error(error);
      setHistoryLoadFailed(true);
      startTransition(() => {
        setHistory([]);
      });
    } finally {
      setIsHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [workspaceSlug, historyScope]);

  function togglePromptOption(
    group: keyof PromptOptions,
    value: string,
    target: "prompt" | "negative" = "prompt"
  ) {
    setPromptOptions((current) => {
      const exists = current[group].includes(value);
      return {
        ...current,
        [group]: exists
          ? current[group].filter((item) => item !== value)
          : [...current[group], value],
      };
    });

    if (target === "negative") {
      setNegativePrompt((current) =>
        current.includes(value)
          ? current.replace(`, ${value}`, "").replace(value, "").trim()
          : current.trim()
          ? `${current}, ${value}`
          : value
      );
      return;
    }

    setPrompt((current) =>
      current.includes(value)
        ? current.replace(`, ${value}`, "").replace(value, "").trim()
        : current.trim()
        ? `${current}, ${value}`
        : value
    );
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

    setIsGenerating(true);
    setResultImage(null);
    setActiveTab("result");

    try {
      const response = await fetch("/api/image/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          negative_prompt: negativePrompt,
          size,
          workspaceSlug,
          promptOptions,
        }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "创建任务失败");
      }

      const { task_id, historyId } = await response.json();

      const poll = async () => {
        const pollResponse = await fetch(`/api/image/tasks/${task_id}`);

        if (!pollResponse.ok) {
          throw new Error((await pollResponse.text()) || "查询任务状态失败");
        }

        const data = await pollResponse.json();

        if (data.task_status === "SUCCEED") {
          setResultImage(data.output_images?.[0] ?? null);
          setIsGenerating(false);
          toast({
            type: "success",
            description: "图片已生成并自动上传到素材库",
          });
          await loadHistory();
          return;
        }

        if (data.task_status === "FAILED") {
          setIsGenerating(false);
          toast({
            type: "error",
            description: data.history?.errorMessage || "图片生成失败",
          });
          await loadHistory();
          return;
        }

        setTimeout(poll, 2500);
      };

      poll();
    } catch (error) {
      console.error(error);
      toast({
        type: "error",
        description: error instanceof Error ? error.message : "生成请求失败",
      });
      setIsGenerating(false);
    }
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
