/**
 * 全局 PDF 转换任务 store（Zustand 单例）。
 *
 * 状态在客户端 JS 上下文中常驻，切换路由不销毁——与原先 Map + EventTarget 行为一致，
 * 便于在任意模块调用 `startConvertTask`，在 React 中用 hook 或 `subscribe` 消费。
 */

import { create } from "zustand";

export type ConvertStatus = "converting" | "done" | "error";

export type ConvertTask = {
  docId: string;
  status: ConvertStatus;
  progress: string;
  /** 转换完成后的 markdown 内容（仅 status=done 时有值） */
  markdown?: string;
  error?: string;
};

type TasksMap = Record<string, ConvertTask>;

type ConvertStoreState = {
  tasks: TasksMap;
};

const useConvertTaskStore = create<ConvertStoreState>(() => ({
  tasks: {},
}));

/** 开始一个转换任务 */
export function startConvertTask(docId: string, progress: string) {
  useConvertTaskStore.setState((s) => ({
    tasks: { ...s.tasks, [docId]: { docId, status: "converting", progress } },
  }));
}

/** 更新进度文字 */
export function updateConvertProgress(docId: string, progress: string) {
  const task = useConvertTaskStore.getState().tasks[docId];
  if (!task) {
    return;
  }
  useConvertTaskStore.setState((s) => ({
    tasks: { ...s.tasks, [docId]: { ...task, progress } },
  }));
}

/** 标记完成 */
export function finishConvertTask(docId: string, markdown: string) {
  useConvertTaskStore.setState((s) => ({
    tasks: {
      ...s.tasks,
      [docId]: {
        docId,
        status: "done",
        progress: "转换完成，正在保存...",
        markdown,
      },
    },
  }));
}

/** 标记失败 */
export function failConvertTask(docId: string, error: string) {
  useConvertTaskStore.setState((s) => ({
    tasks: {
      ...s.tasks,
      [docId]: { docId, status: "error", progress: error, error },
    },
  }));
}

/** 清除任务（保存完成后调用） */
export function clearConvertTask(docId: string) {
  useConvertTaskStore.setState((s) => {
    const { [docId]: _, ...rest } = s.tasks;
    return { tasks: rest };
  });
}

/** 获取当前任务快照 */
export function getConvertTask(docId: string): ConvertTask | undefined {
  return useConvertTaskStore.getState().tasks[docId];
}

/** 订阅变更，返回取消订阅函数（仅在该 docId 对应任务引用变化时回调） */
export function subscribeConvertTask(
  docId: string,
  callback: (task: ConvertTask | undefined) => void
): () => void {
  return useConvertTaskStore.subscribe((state, prev) => {
    const next = state.tasks[docId];
    const previous = prev.tasks[docId];
    if (next === previous) {
      return;
    }
    callback(next);
  });
}

/** React 中按文档订阅当前转换任务（该 docId 的任务变化时重渲染） */
export function useConvertTask(docId: string): ConvertTask | undefined {
  return useConvertTaskStore((s) => s.tasks[docId]);
}

/** 是否存在正在解析/保存中的 PDF 任务（用于禁止并发上传） */
function isPdfPipelineBusy(task: ConvertTask): boolean {
  return task.status === "converting" || task.status === "done";
}

/** 当前文档是否处于转换流水线中（用于锁定编辑器 UI） */
export function isConvertTaskPipelineBusy(
  task: ConvertTask | undefined
): boolean {
  if (!task) {
    return false;
  }
  return isPdfPipelineBusy(task);
}

export function isPdfConversionBusy(): boolean {
  return Object.values(useConvertTaskStore.getState().tasks).some(
    isPdfPipelineBusy
  );
}

/** React：任一文档处于转换或保存中时返回 true */
export function usePdfConversionBusy(): boolean {
  return useConvertTaskStore((s) =>
    Object.values(s.tasks).some(isPdfPipelineBusy)
  );
}
