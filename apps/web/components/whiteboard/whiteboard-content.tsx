"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorLoadingSkeleton } from "@/components/editor/editor-loading-skeleton";
import { useCollaboration } from "@/components/editor/collaboration-context";
import { WhiteboardClient } from "./whiteboard-client";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { useCollabToken } from "@/hooks/use-collab-token";
import { useDebounce } from "@/hooks/use-debounce";
import { generateUserColor } from "@repo/editor";
import type { ConnectionStatus } from "@repo/editor";

function encodeYjsStateToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j += 1) {
      binary += String.fromCharCode(bytes[j]);
    }
  }
  return globalThis.btoa(binary);
}

interface WhiteboardContentProps {
  documentId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
}

export function WhiteboardContent({
  documentId,
  userId,
  userName,
  userEmail,
  userAvatarUrl,
}: WhiteboardContentProps) {
  const { data: document, isLoading } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();
  const { setConnectedUsers, setConnectionStatus } = useCollaboration();

  const [localYjsStateB64, setLocalYjsStateB64] = useState<string | null>(null);
  const [permissionRevoked, setPermissionRevoked] = useState(false);
  const [collabPersistenceFallback, setCollabPersistenceFallback] = useState(false);
  const prevLocalYjsStateB64Ref = useRef<string | null>(null);

  const localYjsStateB64Debounced = useDebounce(localYjsStateB64, 1000);

  const isReadOnly =
    !!document?.deletedAt || (document as { accessLevel?: string })?.accessLevel === "view";
  const effectiveReadOnly = isReadOnly || permissionRevoked;

  const shouldConnectCollab = useMemo(() => {
    if (!document || document.id !== documentId || document.deletedAt) {
      return false;
    }
    if (permissionRevoked) {
      return false;
    }
    const accessLevel = (document as { accessLevel?: string }).accessLevel;
    return Boolean(accessLevel);
  }, [document, documentId, permissionRevoked]);

  const {
    data: collabData,
    isLoading: isTokenLoading,
    isError: isCollabTokenError,
  } = useCollabToken(shouldConnectCollab ? documentId : null);

  const collabServerUrl = useMemo(() => {
    const envUrl = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL;
    if (envUrl) {
      return envUrl;
    }
    try {
      const u = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8080");
      u.protocol = u.protocol.replace("http", "ws");
      u.port = "4000";
      u.pathname = "/collab";
      return u.toString();
    } catch {
      return "ws://localhost:4000/collab";
    }
  }, []);

  const collabConfig = useMemo(() => {
    if (!shouldConnectCollab || !collabData?.token) {
      return null;
    }
    return { serverUrl: collabServerUrl, token: collabData.token };
  }, [collabData?.token, collabServerUrl, shouldConnectCollab]);

  const useHttpPersistence =
    !shouldConnectCollab || collabPersistenceFallback || isCollabTokenError;

  const initialYjsStateB64 = useMemo(() => {
    if (collabConfig) {
      return null;
    }
    const raw = (document as { yjsState?: string | null } | undefined)?.yjsState;
    return raw ?? null;
  }, [collabConfig, document]);

  const user = useMemo(() => {
    if (!userId) {
      return undefined;
    }
    return {
      name: userName || userEmail?.split("@")[0] || "Anonymous",
      color: generateUserColor(userId),
      avatar: userAvatarUrl,
    };
  }, [userAvatarUrl, userEmail, userId, userName]);

  useEffect(() => {
    if (
      !useHttpPersistence ||
      !localYjsStateB64Debounced ||
      localYjsStateB64Debounced === prevLocalYjsStateB64Ref.current
    ) {
      return;
    }
    prevLocalYjsStateB64Ref.current = localYjsStateB64Debounced;
    updateDocumentMutation.mutate({
      documentId,
      updates: { yjsState: localYjsStateB64Debounced },
    });
  }, [
    documentId,
    localYjsStateB64Debounced,
    updateDocumentMutation,
    useHttpPersistence,
  ]);

  const handleLocalYjsState = useCallback(
    (state: Uint8Array) => {
      if (effectiveReadOnly) {
        return;
      }
      setLocalYjsStateB64(encodeYjsStateToBase64(state));
    },
    [effectiveReadOnly]
  );

  const handleConnectionStatusChange = useCallback(
    (status: ConnectionStatus) => {
      setConnectionStatus(status);
      if (status === "disconnected" && shouldConnectCollab) {
        setCollabPersistenceFallback(true);
      }
    },
    [setConnectionStatus, shouldConnectCollab]
  );


  if (isLoading || (shouldConnectCollab && isTokenLoading && !isCollabTokenError)) {
    return <EditorLoadingSkeleton className="min-h-full pt-14" />;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden pt-14">
      <div className="relative min-h-0 flex-1">
        <WhiteboardClient
          documentId={documentId}
          initialYjsStateB64={initialYjsStateB64}
          user={user}
          collabConfig={collabConfig}
          readonly={effectiveReadOnly}
          onConnectedUsersChange={setConnectedUsers}
          onConnectionStatusChange={handleConnectionStatusChange}
          onLocalYjsState={useHttpPersistence ? handleLocalYjsState : undefined}
          enableHttpPersistence={useHttpPersistence}
        />
      </div>
    </div>
  );
}
