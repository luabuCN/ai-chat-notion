"use client";

import { apiFetch } from "@/lib/api-client";
import {
  cancelImageGenerationTask,
  cancelAllImageGenerationTasks,
  completeImageGenerationTask,
  failImageGenerationTask,
  getPendingImageGenerationTasks,
  updateImageGenerationTask,
} from "./generation-store";

const POLL_INTERVAL_MS = 2500;
const pollingTasks = new Set<string>();
const cancelledTasks = new Set<string>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PollCallbacks = {
  onComplete?: (taskId: string, outputImageUrl: string) => void;
  onFailed?: (taskId: string, error: string) => void;
};

export function cancelBackgroundImagePoll(taskId: string) {
  cancelledTasks.add(taskId);
  cancelImageGenerationTask(taskId);
}

export function cancelAllBackgroundImagePolls() {
  for (const taskId of pollingTasks) {
    cancelledTasks.add(taskId);
  }
  for (const task of getPendingImageGenerationTasks()) {
    cancelledTasks.add(task.taskId);
  }
  cancelAllImageGenerationTasks();
}

export function isBackgroundImagePollActive(taskId: string) {
  return pollingTasks.has(taskId);
}

export function startBackgroundImagePoll(
  taskId: string,
  callbacks?: PollCallbacks
) {
  if (pollingTasks.has(taskId) || cancelledTasks.has(taskId)) {
    return;
  }

  pollingTasks.add(taskId);
  void (async () => {
    try {
      updateImageGenerationTask(taskId, {
        status: "processing",
        progress: "正在生成图片...",
      });

      while (true) {
        if (cancelledTasks.has(taskId)) {
          cancelledTasks.delete(taskId);
          return;
        }

        const response = await apiFetch(`/api/image/tasks/${taskId}`);
        if (!response.ok) {
          const message = (await response.text()) || "查询任务状态失败";
          throw new Error(message);
        }

        const data = (await response.json()) as {
          task_status?: string;
          output_images?: string[];
          history?: { errorMessage?: string | null };
          message?: string;
        };

        if (data.task_status === "SUCCEED") {
          const outputImageUrl = data.output_images?.[0];
          if (!outputImageUrl) {
            throw new Error("生成成功但未返回图片地址");
          }

          completeImageGenerationTask(taskId, outputImageUrl);
          callbacks?.onComplete?.(taskId, outputImageUrl);
          return;
        }

        if (data.task_status === "FAILED") {
          const errorMessage =
            data.history?.errorMessage ||
            data.message ||
            "图片生成失败";
          failImageGenerationTask(taskId, errorMessage);
          callbacks?.onFailed?.(taskId, errorMessage);
          return;
        }

        updateImageGenerationTask(taskId, {
          status: "processing",
          progress: "正在生成图片...",
        });

        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      if (cancelledTasks.has(taskId)) {
        cancelledTasks.delete(taskId);
        return;
      }

      const message =
        error instanceof Error ? error.message : "图片生成失败";
      failImageGenerationTask(taskId, message);
      callbacks?.onFailed?.(taskId, message);
    } finally {
      pollingTasks.delete(taskId);
    }
  })();
}

export function resumePendingImagePolls(callbacks?: PollCallbacks) {
  for (const task of getPendingImageGenerationTasks()) {
    startBackgroundImagePoll(task.taskId, callbacks);
  }
}

export function notifyImageGenerationComplete(
  providerTaskId: string,
  outputImageUrl: string
) {
  if (pollingTasks.has(providerTaskId) || cancelledTasks.has(providerTaskId)) {
    return;
  }

  completeImageGenerationTask(providerTaskId, outputImageUrl);
}
