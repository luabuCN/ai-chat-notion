"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFileUploadMutation } from "@/hooks/use-file-upload-mutation";
import "@repo/editor/styles";
import type {
  CollaborativeUser,
  ConnectionStatus,
} from "@repo/editor";

const UnifiedEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.UnifiedEditor),
  { ssr: false }
);

interface UnifiedEditorClientProps {
  documentId: string;
  /** 初始内容（JSON 字符串） */
  initialContent?: string;
  /** 用户信息（用于协同光标） */
  user?: CollaborativeUser;
  /** 协同服务器配置（null = 本地模式） */
  collabConfig?: {
    serverUrl: string;
    token: string;
  } | null;
  readonly?: boolean;
  placeholder?: string;
  /** IndexedDB 同步完成回调 */
  onIndexedDBSynced?: () => void;
  /** WebSocket 同步完成回调 */
  onWebSocketSynced?: () => void;
  onDisconnect?: () => void;
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onUpdate?: (editor: any) => void;
}

export const UnifiedEditorClient = memo(
  function UnifiedEditorClient({
    documentId,
    initialContent,
    user,
    collabConfig,
    readonly,
    placeholder,
    onIndexedDBSynced,
    onWebSocketSynced,
    onDisconnect,
    onConnectedUsersChange,
    onConnectionStatusChange,
    onUpdate,
  }: UnifiedEditorClientProps) {
    const router = useRouter();
    const navigate = useCallback(
      (href: string) => router.push(href),
      [router]
    );
    const { mutateAsync: uploadFileMutation } = useFileUploadMutation();

    const uploadFile = useCallback(
      async (file: File) => {
        const result = await uploadFileMutation(file);
        return result.url;
      },
      [uploadFileMutation]
    );

    // 稳定的协同配置（避免不必要的重新渲染）
    const stableCollabConfig = useMemo(() => {
      if (!collabConfig) return null;
      return {
        serverUrl: collabConfig.serverUrl,
        token: collabConfig.token,
      };
    }, [collabConfig?.serverUrl, collabConfig?.token]);

    const handleIndexedDBSynced = useCallback(() => {
      console.log("[UnifiedEditor] IndexedDB synced");
      onIndexedDBSynced?.();
    }, [onIndexedDBSynced]);

    const handleWebSocketSynced = useCallback(() => {
      console.log("[UnifiedEditor] WebSocket synced");
      onWebSocketSynced?.();
    }, [onWebSocketSynced]);

    const handleDisconnect = useCallback(() => {
      console.log("[UnifiedEditor] Disconnected from server");
      onDisconnect?.();
    }, [onDisconnect]);

    return (
      <UnifiedEditor
        documentId={documentId}
        initialContent={initialContent}
        user={user}
        collabConfig={stableCollabConfig}
        placeholder={placeholder ?? "Type / for commands..."}
        showAiTools={true}
        uploadFile={uploadFile}
        readonly={readonly}
        navigate={navigate}
        onIndexedDBSynced={handleIndexedDBSynced}
        onWebSocketSynced={handleWebSocketSynced}
        onDisconnect={handleDisconnect}
        onConnectedUsersChange={onConnectedUsersChange}
        onConnectionStatusChange={onConnectionStatusChange}
        onUpdate={onUpdate}
      />
    );
  }
);