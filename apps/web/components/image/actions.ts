import { useMutation, useQuery } from "@tanstack/react-query";
import type { HistoryItem, PromptOptions } from "./types";
import { apiFetch } from "@/lib/api-client";
import {
  addImageGenerationTask,
  setActiveImageGenerationTask,
} from "@/lib/image-generation/generation-store";
import { startBackgroundImagePoll } from "@/lib/image-generation/generation-runner";

interface GenerateImagePayload {
  model: string;
  prompt: string;
  negative_prompt?: string;
  size: string;
  workspaceSlug?: string;
  promptOptions: PromptOptions;
}

type CreateImageResponse = {
  task_id: string;
  historyId?: string;
  backgroundJobId?: string | null;
};

export async function createImageGenerationTask(
  payload: GenerateImagePayload
): Promise<{ taskId: string; historyId?: string }> {
  const response = await apiFetch("/api/image/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || "创建任务失败");
  }

  const data = (await response.json()) as CreateImageResponse;

  addImageGenerationTask({
    taskId: data.task_id,
    historyId: data.historyId,
    prompt: payload.prompt,
    status: "pending",
    progress: "已提交，等待生成...",
    createdAt: Date.now(),
  });
  setActiveImageGenerationTask(data.task_id);

  startBackgroundImagePoll(data.task_id);

  return { taskId: data.task_id, historyId: data.historyId };
}

export function useCreateImageGenerationTask() {
  return useMutation({
    mutationFn: createImageGenerationTask,
  });
}

export function useDeleteImageHistory() {
  return useMutation({
    mutationFn: async (historyId: string) => {
      const response = await apiFetch(`/api/image/history/${historyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "删除失败");
      }
    },
  });
}

export function useImageHistory(
  workspaceSlug?: string,
  scope: "workspace" | "user" = "user",
  options?: { enabled?: boolean; refetchPending?: boolean }
) {
  const enabled = options?.enabled ?? true;
  const refetchPending = options?.refetchPending ?? false;

  return useQuery({
    queryKey: ["image-history", workspaceSlug, scope],
    enabled,
    refetchInterval: refetchPending ? 3000 : false,
    queryFn: async () => {
      const params = new URLSearchParams({ scope, limit: "30" });
      if (workspaceSlug) {
        params.set("workspace", workspaceSlug);
      }

      const response = await apiFetch(`/api/image/history?${params.toString()}`);
      if (!response.ok) {
        throw new Error("加载历史记录失败");
      }

      const data = await response.json();
      return (data.items || []) as HistoryItem[];
    },
  });
}

export function useOptimizePrompt() {
  return useMutation({
    mutationFn: async ({
      prompt,
      onUpdate,
    }: {
      prompt: string;
      onUpdate: (value: string) => void;
    }) => {
      const response = await apiFetch("/api/ai/completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `请帮我优化以下 AI 绘画提示词，使其更加丰富、专业，并补充合适的风格、光影、材质等细节词汇。如果原提示词已经是英文，请用英文输出优化结果；否则请用中文输出优化后的提示词内容。不要输出任何其他解释性的话语，直接输出优化后的提示词内容即可。\n\n原提示词：\n${prompt}`,
          system:
            "你是一个专业的 AI 绘画提示词（Prompt）专家。你的任务是将用户提供的简单描述扩写为高质量、细节丰富的绘画提示词，以获得更好的出图效果。你直接输出优化结果，绝对不要附带解释、问候或多余符号。",
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        throw new Error("AI 优化请求失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let optimizedText = "";

      onUpdate("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        optimizedText += chunk;
        onUpdate(optimizedText);
      }
      return optimizedText;
    },
  });
}
