"use client";

import { create } from "zustand";

export type ImageGenTaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type ImageGenTask = {
  taskId: string;
  historyId?: string;
  prompt: string;
  status: ImageGenTaskStatus;
  progress: string;
  outputImageUrl?: string;
  error?: string;
  createdAt: number;
};

type ImageGenerationStoreState = {
  tasks: Record<string, ImageGenTask>;
  activeTaskId: string | null;
};

const STORAGE_KEY = "image-gen-pending-tasks:v1";

const useImageGenerationStore = create<ImageGenerationStoreState>(() => ({
  tasks: {},
  activeTaskId: null,
}));

function persistPendingTaskIds(taskIds: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(taskIds));
  } catch {
    // ignore quota / private mode
  }
}

function readPersistedTaskIds(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function syncPersistedTasks(tasks: Record<string, ImageGenTask>) {
  const pendingIds = Object.values(tasks)
    .filter((task) => task.status === "pending" || task.status === "processing")
    .map((task) => task.taskId);
  persistPendingTaskIds(pendingIds);
}

export function addImageGenerationTask(task: ImageGenTask) {
  useImageGenerationStore.setState((state) => {
    const nextTasks = { ...state.tasks, [task.taskId]: task };
    syncPersistedTasks(nextTasks);
    return {
      tasks: nextTasks,
      activeTaskId: task.taskId,
    };
  });
}

export function updateImageGenerationTask(
  taskId: string,
  patch: Partial<Omit<ImageGenTask, "taskId">>
) {
  useImageGenerationStore.setState((state) => {
    const current = state.tasks[taskId];
    if (!current) {
      return state;
    }

    const nextTasks = {
      ...state.tasks,
      [taskId]: { ...current, ...patch },
    };
    syncPersistedTasks(nextTasks);
    return { tasks: nextTasks };
  });
}

export function completeImageGenerationTask(
  taskId: string,
  outputImageUrl: string
) {
  updateImageGenerationTask(taskId, {
    status: "completed",
    progress: "图片生成完成",
    outputImageUrl,
  });
}

export function failImageGenerationTask(taskId: string, error: string) {
  updateImageGenerationTask(taskId, {
    status: "failed",
    progress: error,
    error,
  });
}

export function cancelImageGenerationTask(taskId: string) {
  updateImageGenerationTask(taskId, {
    status: "cancelled",
    progress: "已暂停跟踪",
  });
}

export function cancelAllImageGenerationTasks() {
  useImageGenerationStore.setState((state) => {
    const nextTasks = { ...state.tasks };
    for (const task of Object.values(nextTasks)) {
      if (task.status === "pending" || task.status === "processing") {
        nextTasks[task.taskId] = {
          ...task,
          status: "cancelled",
          progress: "已暂停跟踪",
        };
      }
    }
    syncPersistedTasks(nextTasks);
    return {
      tasks: nextTasks,
      activeTaskId: null,
    };
  });
}

export function removeImageGenerationTask(taskId: string) {
  useImageGenerationStore.setState((state) => {
    const { [taskId]: _, ...rest } = state.tasks;
    syncPersistedTasks(rest);
    return {
      tasks: rest,
      activeTaskId:
        state.activeTaskId === taskId ? null : state.activeTaskId,
    };
  });
}

export function setActiveImageGenerationTask(taskId: string | null) {
  useImageGenerationStore.setState({ activeTaskId: taskId });
}

export function getImageGenerationTask(
  taskId: string
): ImageGenTask | undefined {
  return useImageGenerationStore.getState().tasks[taskId];
}

export function useImageGenerationTask(
  taskId: string | null
): ImageGenTask | undefined {
  return useImageGenerationStore((state) =>
    taskId ? state.tasks[taskId] : undefined
  );
}

export function useActiveImageGenerationTask(): ImageGenTask | undefined {
  return useImageGenerationStore((state) =>
    state.activeTaskId ? state.tasks[state.activeTaskId] : undefined
  );
}

export function usePendingImageGenerationCount(): number {
  return useImageGenerationStore(
    (state) =>
      Object.values(state.tasks).filter(
        (task) => task.status === "pending" || task.status === "processing"
      ).length
  );
}

export function useImageGenerationTasks(): ImageGenTask[] {
  return useImageGenerationStore((state) =>
    Object.values(state.tasks).toSorted(
      (left, right) => right.createdAt - left.createdAt
    )
  );
}

export function getPendingImageGenerationTasks(): ImageGenTask[] {
  return Object.values(useImageGenerationStore.getState().tasks).filter(
    (task) => task.status === "pending" || task.status === "processing"
  );
}

export function hydrateImageGenerationTasksFromSession() {
  const persistedIds = readPersistedTaskIds();
  if (persistedIds.length === 0) {
    return;
  }

  useImageGenerationStore.setState((state) => {
    const nextTasks = { ...state.tasks };

    for (const taskId of persistedIds) {
      if (!nextTasks[taskId]) {
        nextTasks[taskId] = {
          taskId,
          prompt: "恢复中的生成任务",
          status: "processing",
          progress: "正在恢复任务状态...",
          createdAt: Date.now(),
        };
      }
    }

    return { tasks: nextTasks };
  });
}

export function subscribeImageGenerationStore(
  listener: (state: ImageGenerationStoreState) => void
) {
  return useImageGenerationStore.subscribe(listener);
}
