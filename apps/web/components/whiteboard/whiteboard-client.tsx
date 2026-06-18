"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type {
  CollaborativeUser,
  ConnectionStatus,
} from "@repo/editor";
import "@repo/whiteboard/styles";

const WhiteboardEditor = dynamic(
  () => import("@repo/whiteboard").then((mod) => mod.WhiteboardEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-muted/30" aria-hidden />
    ),
  }
);

interface WhiteboardClientProps {
  documentId: string;
  initialYjsStateB64?: string | null;
  user?: CollaborativeUser;
  collabConfig?: { serverUrl: string; token: string } | null;
  readonly?: boolean;
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onLocalYjsState?: (state: Uint8Array) => void;
  enableHttpPersistence?: boolean;
  onPermissionRevoked?: () => void;
}

export const WhiteboardClient = memo(function WhiteboardClient({
  documentId,
  initialYjsStateB64,
  user,
  collabConfig,
  readonly,
  onConnectedUsersChange,
  onConnectionStatusChange,
  onLocalYjsState,
  enableHttpPersistence,
}: WhiteboardClientProps) {
  const stableCollabConfig = useMemo(() => {
    if (!collabConfig) {
      return null;
    }
    return {
      serverUrl: collabConfig.serverUrl,
      token: collabConfig.token,
    };
  }, [collabConfig?.serverUrl, collabConfig?.token]);

  return (
    <div className="absolute inset-0">
      <WhiteboardEditor
        documentId={documentId}
        initialYjsStateB64={initialYjsStateB64}
        user={user}
        collabConfig={stableCollabConfig}
        readonly={readonly}
        onConnectedUsersChange={onConnectedUsersChange}
        onConnectionStatusChange={onConnectionStatusChange}
        onLocalYjsState={onLocalYjsState}
        enableHttpPersistence={enableHttpPersistence}
        className="h-full w-full"
      />
    </div>
  );
});
