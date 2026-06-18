"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
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

function mapLocaleToExcalidraw(locale: string): string {
  if (locale === "zh" || locale.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

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
  collabSessionKey?: number;
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
  onPermissionRevoked,
  collabSessionKey,
}: WhiteboardClientProps) {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();

  const stableCollabConfig = useMemo(() => {
    if (!collabConfig) {
      return null;
    }
    return {
      serverUrl: collabConfig.serverUrl,
      token: collabConfig.token,
    };
  }, [collabConfig?.serverUrl, collabConfig?.token]);

  const excalidrawTheme = resolvedTheme === "dark" ? "dark" : "light";
  const langCode = mapLocaleToExcalidraw(locale);

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
        onPermissionRevoked={onPermissionRevoked}
        collabSessionKey={collabSessionKey}
        className="h-full w-full"
        theme={excalidrawTheme}
        langCode={langCode}
      />
    </div>
  );
});
