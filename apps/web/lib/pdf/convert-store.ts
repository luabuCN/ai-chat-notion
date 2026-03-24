/**
 * 全局 PDF 转换任务 store。
 *
 * 用原生 EventTarget 实现发布/订阅，不依赖任何外部状态库。
 * 任务状态存在模块级 Map 里，生命周期跟随页面 JS 上下文，
 * 切换路由不会销毁——这正是「切换文档不中断」的关键。
 */

export type ConvertStatus = "converting" | "done" | "error";

export type ConvertTask = {
  docId: string;
  status: ConvertStatus;
  progress: string;
  /** 转换完成后的 markdown 内容（仅 status=done 时有值） */
  markdown?: string;
  error?: string;
};

const tasks = new Map<string, ConvertTask>();
const emitter = new EventTarget();

const CHANGE_EVENT = "change";

/** 开始一个转换任务 */
export function startConvertTask(docId: string, progress: string) {
  tasks.set(docId, { docId, status: "converting", progress });
  emitter.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: docId }));
}

/** 更新进度文字 */
export function updateConvertProgress(docId: string, progress: string) {
  const task = tasks.get(docId);
  if (!task) return;
  tasks.set(docId, { ...task, progress });
  emitter.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: docId }));
}

/** 标记完成 */
export function finishConvertTask(docId: string, markdown: string) {
  tasks.set(docId, {
    docId,
    status: "done",
    progress: "转换完成，正在保存...",
    markdown,
  });
  emitter.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: docId }));
}

/** 标记失败 */
export function failConvertTask(docId: string, error: string) {
  tasks.set(docId, { docId, status: "error", progress: error, error });
  emitter.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: docId }));
}

/** 清除任务（保存完成后调用） */
export function clearConvertTask(docId: string) {
  tasks.delete(docId);
  emitter.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: docId }));
}

/** 获取当前任务快照 */
export function getConvertTask(docId: string): ConvertTask | undefined {
  return tasks.get(docId);
}

/** 订阅变更，返回取消订阅函数 */
export function subscribeConvertTask(
  docId: string,
  callback: (task: ConvertTask | undefined) => void
): () => void {
  const handler = (e: Event) => {
    const changedDocId = (e as CustomEvent<string>).detail;
    if (changedDocId === docId) {
      callback(tasks.get(docId));
    }
  };
  emitter.addEventListener(CHANGE_EVENT, handler);
  return () => emitter.removeEventListener(CHANGE_EVENT, handler);
}
