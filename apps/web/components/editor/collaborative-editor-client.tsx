"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useMemo } from "react";
import { toast } from "sonner";
import "@repo/editor/styles";
import type { CollaborativeUser, ConnectionStatus } from "@repo/editor";

const CollaborativeEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.CollaborativeEditor),
  { ssr: false }
);

interface CollaborativeEditorClientProps {
  documentId: string;
  token: string;
  user: CollaborativeUser;
  serverUrl?: string;
  readonly?: boolean;
  onSynced?: () => void;
  onDisconnect?: () => void;
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
}

export const CollaborativeEditorClient = memo(
  function CollaborativeEditorClient({
    documentId,
    token,
    user,
    serverUrl,
    readonly,
    onSynced,
    onDisconnect,
    onConnectedUsersChange,
    onConnectionStatusChange,
  }: CollaborativeEditorClientProps) {
    const uploadFile = useCallback(async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          console.log("Upload successful", data);
          return data.url;
        }
        const { error } = await response.json();
        toast.error(error);
        throw new Error(error);
      } catch (_error) {
        toast.error("Failed to upload file, please try again!");
        throw _error;
      }
    }, []);

    const handleSynced = useCallback(() => {
      console.log("[CollabEditor] Document synced");
      onSynced?.();
    }, [onSynced]);

    const handleDisconnect = useCallback(() => {
      console.log("[CollabEditor] Disconnected from server");
      toast.warning("连接已断开", {
        description: "正在尝试重新连接...",
      });
      onDisconnect?.();
    }, [onDisconnect]);

    return (
      <CollaborativeEditor
        documentId={documentId}
        token={token}
        user={user}
        serverUrl={serverUrl}
        placeholder="Type / for commands..."
        showAiTools={true}
        uploadFile={uploadFile}
        readonly={readonly}
        onSynced={handleSynced}
        onDisconnect={handleDisconnect}
        onConnectedUsersChange={onConnectedUsersChange}
        onConnectionStatusChange={onConnectionStatusChange}
      />
    );
  }
);
