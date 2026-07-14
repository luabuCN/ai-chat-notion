import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

interface UseIndexeddbPersistenceResult {
  persistence: IndexeddbPersistence | null;
  isRestored: boolean;
}

/**
 * 将 ydoc 状态缓存到浏览器 IndexedDB，实现二次打开秒开。
 *
 * y-indexeddb 作为客户端读取缓存层，不替代服务端持久化。
 * 本地降级模式下 HTTP PATCH 仍用于 content + yjsState 持久化，
 * HTTP includeYjsState 仍用于首次加载恢复。
 *
 * 时序：persistence 创建 → whenSynced（2s 超时）→ Provider 创建 → WS 连接
 */
export function useIndexeddbPersistence(
  ydoc: Y.Doc,
  documentId: string,
  skip = false
): UseIndexeddbPersistenceResult {
  const [persistence, setPersistence] = useState<IndexeddbPersistence | null>(
    null
  );
  const [isRestored, setIsRestored] = useState(false);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  useEffect(() => {
    if (skip) {
      setIsRestored(true);
      return;
    }

    let cancelled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      const p = new IndexeddbPersistence(documentId, ydoc);
      persistenceRef.current = p;

      // 超时 2s：无论 IndexedDB 是否同步完成，都标记为 restored 让流程继续
      const timeoutPromise = new Promise<boolean>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(false), 2000);
      });

      const syncedPromise = p.whenSynced.then(() => true).catch(() => false);

      Promise.race([syncedPromise, timeoutPromise]).then(() => {
        if (cancelled) return;
        setIsRestored(true);
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      });

      setPersistence(p);
    } catch (e) {
      // IndexedDB 不可用时 graceful degrade：不影响编辑功能
      console.warn("[y-indexeddb] Failed to create persistence:", e);
      setIsRestored(true);
    }

    return () => {
      cancelled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
    };
  }, [ydoc, documentId, skip]);

  return { persistence, isRestored };
}
