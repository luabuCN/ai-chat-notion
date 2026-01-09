import { useCallback, useEffect, useMemo, useState } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import type {
  CollaborativeUser,
  ConnectionStatus,
} from "../collaborative-editor";

export interface UseCollaborativeEditorOptions {
  documentId: string;
  token: string;
  user: CollaborativeUser;
  serverUrl?: string;
  onSynced?: () => void;
  onDisconnect?: () => void;
  onAuthenticationFailed?: (reason: string) => void;
}

export interface UseCollaborativeEditorReturn {
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  status: ConnectionStatus;
  connectedUsers: CollaborativeUser[];
  isConnected: boolean;
  isSynced: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

/**
 * 用于协同编辑的 React Hook
 * 管理 Yjs 文档和 Hocuspocus Provider 的生命周期
 */
export function useCollaborativeEditor({
  documentId,
  token,
  user,
  serverUrl = "ws://localhost:1234",
  onSynced,
  onDisconnect,
  onAuthenticationFailed,
}: UseCollaborativeEditorOptions): UseCollaborativeEditorReturn {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [connectedUsers, setConnectedUsers] = useState<CollaborativeUser[]>([]);
  const [isSynced, setIsSynced] = useState(false);

  // 创建 Yjs 文档
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  // 创建 Provider
  const provider = useMemo(() => {
    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token,
      onStatus: ({ status: s }) => {
        setStatus(s as ConnectionStatus);
        if (s === "disconnected") {
          setIsSynced(false);
          onDisconnect?.();
        }
      },
      onSynced: ({ state }) => {
        if (state) {
          setIsSynced(true);
          onSynced?.();
        }
      },
      onAwarenessUpdate: ({ states }) => {
        const users = Array.from(states.values())
          .filter(
            (state: Record<string, unknown>) =>
              state.user && (state.user as Record<string, unknown>).name
          )
          .map(
            (state: Record<string, unknown>) => state.user as CollaborativeUser
          );
        setConnectedUsers(users);
      },
      onAuthenticationFailed: ({ reason }) => {
        console.error("[Collab] Authentication failed:", reason);
        onAuthenticationFailed?.(reason || "Authentication failed");
      },
    });

    p.setAwarenessField("user", user);

    return p;
  }, [
    documentId,
    serverUrl,
    token,
    ydoc,
    user,
    onSynced,
    onDisconnect,
    onAuthenticationFailed,
  ]);

  // 清理
  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  // 重新连接
  const reconnect = useCallback(() => {
    if (provider) {
      provider.connect();
    }
  }, [provider]);

  // 断开连接
  const disconnect = useCallback(() => {
    if (provider) {
      provider.disconnect();
    }
  }, [provider]);

  return {
    ydoc,
    provider,
    status,
    connectedUsers,
    isConnected: status === "connected",
    isSynced,
    reconnect,
    disconnect,
  };
}

export default useCollaborativeEditor;
