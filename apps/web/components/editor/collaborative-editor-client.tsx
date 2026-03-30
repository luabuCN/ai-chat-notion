"use client";

import dynamic from "next/dynamic";
import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useFileUploadMutation } from "@/hooks/use-file-upload-mutation";
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
  serverUrl: string;
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
    const router = useRouter();
    const navigate = useCallback((href: string) => router.push(href), [router]);
    const { mutateAsync: uploadFileMutation } = useFileUploadMutation();

    const uploadFile = useCallback(
      async (file: File) => {
        const result = await uploadFileMutation(file);
        return result.url;
      },
      [uploadFileMutation]
    );

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
        navigate={navigate}
        onSynced={handleSynced}
        onDisconnect={handleDisconnect}
        onConnectedUsersChange={onConnectedUsersChange}
        onConnectionStatusChange={onConnectionStatusChange}
      />
    );
  }
);
