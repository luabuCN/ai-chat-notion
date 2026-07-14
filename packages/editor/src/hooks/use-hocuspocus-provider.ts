import { HocuspocusProvider } from "@hocuspocus/provider";
import type { StatesArray } from "@hocuspocus/provider";
import { toast } from "sonner";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { CollaborativeUser } from "./use-collaboration-awareness";
import { resolveCollabWsUrl } from "../lib/resolve-collab-url";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "idle";

type AwarenessStates = StatesArray;

interface CollabConfig {
  serverUrl: string;
  token: string;
}

export interface UseHocuspocusProviderParams {
  documentId: string;
  ydoc: Y.Doc;
  collabConfig: CollabConfig | null;
  isRestored: boolean;
  readonly?: boolean;
  editorKey: string;
  user?: CollaborativeUser;
  awarenessUser: CollaborativeUser | null;
  handleAwarenessUpdate: (states: AwarenessStates) => void;
  httpYjsStateAppliedRef: React.MutableRefObject<boolean>;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onWebSocketSynced?: () => void;
  onDisconnect?: () => void;
  onPermissionRevoked?: () => void;
}

export interface UseHocuspocusProviderResult {
  provider: HocuspocusProvider | null;
  connectionStatus: ConnectionStatus;
  isWebSocketSynced: boolean;
  isClientReady: boolean;
  isMountedRef: React.MutableRefObject<boolean>;
  providerGenerationRef: React.MutableRefObject<number>;
}

/**
 * 管理 HocuspocusProvider 生命周期与协同连接状态。
 *
 * 从原 unified-editor 中提取，行为保持一致：
 * - Provider 在 effect 中创建（documentId / collabConfig / ydoc / readonly / isRestored 变化时重建）；
 * - `providerGenerationRef` 使旧 Provider 的异步回调失效，避免 Strict Mode 丢同步事件；
 * - `onStatus` / `onSynced` / `onAwarenessUpdate` / `onAuthenticationFailed` / `onClose`
 *   均通过 `setTimeout(0)` 延迟并在执行前校验 generation + isMounted；
 * - 5s 兜底定时器在 WS 未同步且无 HTTP yjsState 预灌时触发降级。
 */
export function useHocuspocusProvider({
  documentId,
  ydoc,
  collabConfig,
  isRestored,
  readonly = false,
  editorKey,
  user,
  awarenessUser,
  handleAwarenessUpdate,
  httpYjsStateAppliedRef,
  onConnectionStatusChange,
  onWebSocketSynced,
  onDisconnect,
  onPermissionRevoked,
}: UseHocuspocusProviderParams): UseHocuspocusProviderResult {
  const isMountedRef = useRef(false);
  const providerGenerationRef = useRef(0);
  const wasEverConnectedRef = useRef(false);

  const userRef = useRef(user);
  userRef.current = user;
  const onConnectionStatusChangeRef = useRef(onConnectionStatusChange);
  onConnectionStatusChangeRef.current = onConnectionStatusChange;
  const onWebSocketSyncedRef = useRef(onWebSocketSynced);
  onWebSocketSyncedRef.current = onWebSocketSynced;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;
  const onPermissionRevokedRef = useRef(onPermissionRevoked);
  onPermissionRevokedRef.current = onPermissionRevoked;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    collabConfig ? "connecting" : "idle"
  );
  const [isWebSocketSynced, setIsWebSocketSynced] = useState(!collabConfig);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [isClientReady, setIsClientReady] = useState(false);

  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      providerGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      setIsClientReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // editorKey / collabConfig 切换时重置连接相关状态
  useEffect(() => {
    wasEverConnectedRef.current = false;
    setIsWebSocketSynced(!collabConfig);
  }, [editorKey, collabConfig]);

  /** Provider 必须在 effect 中创建：在 useMemo/render 里建连会触发「未挂载就 setState」警告 */
  useEffect(() => {
    // 只读本地模式（如预览页）：无需 WS 协同，跳过 Provider 创建
    if (!collabConfig && readonly) {
      return;
    }

    // 等待 IndexedDB 恢复完成后再创建 Provider，使 ydoc 已含本地缓存内容
    if (!isRestored) {
      return;
    }

    const generation = providerGenerationRef.current + 1;
    providerGenerationRef.current = generation;

    const serverUrl = collabConfig?.serverUrl || resolveCollabWsUrl();

    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token: collabConfig?.token || "",
      onStatus: ({ status: s }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          const newStatus = s as ConnectionStatus;
          setConnectionStatus(newStatus);
          onConnectionStatusChangeRef.current?.(newStatus);
          if (s === "connected") {
            wasEverConnectedRef.current = true;
          }
          if (s === "disconnected") {
            // 初始连接受阻时会短暂上报 disconnected，不应立刻触发 HTTP 兜底重挂载。
            if (!wasEverConnectedRef.current) {
              return;
            }
            // 不在此处调用 onDisconnect：Hocuspocus 会自动重连，短暂断线不应
            // 立刻销毁 Provider。上层通过 connectionStatus + grace period 再降级。
          }
        }, 0);
      },
      onSynced: ({ state }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          if (state) {
            setIsWebSocketSynced(true);
            onWebSocketSyncedRef.current?.();
          }
        }, 0);
      },
      onAwarenessUpdate: ({ states }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          handleAwarenessUpdate(states);
        }, 0);
      },
      onAuthenticationFailed: ({ reason }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          toast.error("认证失败", {
            description: reason || "无法连接到协同服务器",
          });
        }, 0);
      },
      onClose: ({ event }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          if (event?.code === 4003) {
            p.disconnect();
            onPermissionRevokedRef.current?.();
          }
        }, 0);
      },
    });

    if (userRef.current) {
      p.setAwarenessField("user", userRef.current);
    }

    if (!collabConfig) {
      p.disconnect();
    }

    setProvider(p);

    return () => {
      providerGenerationRef.current += 1;
      p.disconnect();
      p.destroy();
      setProvider(null);
    };
  }, [collabConfig, documentId, ydoc, readonly, isRestored]);

  /** 刷新时 onSynced 可能早于订阅；挂载后补查 provider.synced + 超时兜底 */
  useEffect(() => {
    if (!collabConfig || !provider) {
      return;
    }

    const providerWithSync = provider as HocuspocusProvider & {
      synced?: boolean;
    };
    if (providerWithSync.synced && isMountedRef.current) {
      setIsWebSocketSynced(true);
    }

    const fallbackMs = 5_000;
    const fallbackTimer = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      setIsWebSocketSynced((prev) => {
        if (prev) {
          return prev;
        }
        // HTTP yjsState 已预灌且正文可见时，WS 可在后台继续同步，不必强制 HTTP 兜底重挂载。
        if (httpYjsStateAppliedRef.current) {
          return prev;
        }
        // 协同尚未完成时不可标记为已同步，否则会误用 HTTP 的 initialContent
        // 与随后到达的 Yjs 状态合并，造成正文重复并写入数据库。
        setConnectionStatus("disconnected");
        onConnectionStatusChangeRef.current?.("disconnected");
        onDisconnectRef.current?.();
        return prev;
      });
    }, fallbackMs);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [collabConfig, editorKey, provider]);

  // 更新 awareness（CollaborationCaret 插件 init 也会写 user，需与之保持一致）
  useEffect(() => {
    if (provider && awarenessUser) {
      provider.setAwarenessField("user", awarenessUser);
    }
  }, [provider, awarenessUser]);

  return {
    provider,
    connectionStatus,
    isWebSocketSynced,
    isClientReady,
    isMountedRef,
    providerGenerationRef,
  };
}
