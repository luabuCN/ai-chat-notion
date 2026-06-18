"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Y from "yjs";
import type { WhiteboardEditorProps } from "../types";
import { decodeBase64ToUint8Array } from "../utils/yjs-state";
import { WhiteboardSurface } from "./whiteboard-surface";

export function WhiteboardEditor({
  documentId,
  ydoc: externalYdoc,
  awareness: externalAwareness,
  readonly = false,
  collabConfig,
  initialYjsStateB64,
  user,
  onLocalYjsState,
  enableHttpPersistence = false,
  onConnectedUsersChange,
  onConnectionStatusChange,
  onPermissionRevoked,
  collabSessionKey = 0,
  className,
  theme,
  langCode,
}: WhiteboardEditorProps) {
  const isMountedRef = useRef(true);
  const providerGenerationRef = useRef(0);
  const onPermissionRevokedRef = useRef(onPermissionRevoked);
  onPermissionRevokedRef.current = onPermissionRevoked;
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [collabSynced, setCollabSynced] = useState(false);

  const ydoc = useMemo(() => {
    if (externalYdoc) {
      return externalYdoc;
    }
    const doc = new Y.Doc();
    if (!collabConfig && initialYjsStateB64) {
      try {
        Y.applyUpdate(doc, decodeBase64ToUint8Array(initialYjsStateB64));
      } catch {
        // ignore invalid snapshot
      }
    }
    return doc;
  }, [collabConfig, documentId, externalYdoc, initialYjsStateB64]);

  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      providerGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (externalYdoc || externalAwareness) {
      return;
    }

    const generation = providerGenerationRef.current + 1;
    providerGenerationRef.current = generation;
    setCollabSynced(false);

    const serverUrl =
      collabConfig?.serverUrl ||
      process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ||
      "ws://localhost:4000/collab";

    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token: collabConfig?.token || "",
      onStatus: ({ status }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation || !isMountedRef.current) {
            return;
          }
          onConnectionStatusChange?.(
            status as "connecting" | "connected" | "disconnected" | "idle"
          );
        }, 0);
      },
      onAwarenessUpdate: ({ states }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation || !isMountedRef.current) {
            return;
          }
          const users = Array.from(states.values())
            .filter(
              (state: Record<string, unknown>) =>
                state.user && (state.user as Record<string, unknown>).name
            )
            .map(
              (state: Record<string, unknown>) =>
                state.user as { name: string; color: string; avatar?: string }
            );
          onConnectedUsersChange?.(users);
        }, 0);
      },
      onClose: ({ event }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation || !isMountedRef.current) {
            return;
          }
          if (event?.code === 4003) {
            p.disconnect();
            onPermissionRevokedRef.current?.();
          }
        }, 0);
      },
    });

    if (user) {
      p.setAwarenessField("user", user);
      p.setAwarenessField("whiteboard", {
        scope: "document",
        username: user.name,
        color: user.color,
      });
    }

    if (!collabConfig) {
      p.disconnect();
    }

    setProvider(p);

    const snapshotForPreview = () => {
      if (enableHttpPersistence && onLocalYjsState) {
        onLocalYjsState(Y.encodeStateAsUpdate(ydoc));
      }
    };

    const handleSynced = () => {
      if (providerGenerationRef.current !== generation || !isMountedRef.current) {
        return;
      }
      setCollabSynced(true);
      snapshotForPreview();
    };

    if (collabConfig) {
      p.on("synced", handleSynced);
    } else {
      snapshotForPreview();
    }

    return () => {
      providerGenerationRef.current += 1;
      p.off("synced", handleSynced);
      p.disconnect();
      p.destroy();
      setProvider(null);
      setCollabSynced(false);
    };
  }, [
    collabConfig,
    documentId,
    enableHttpPersistence,
    externalAwareness,
    externalYdoc,
    onConnectedUsersChange,
    onConnectionStatusChange,
    onLocalYjsState,
    user,
    ydoc,
    collabSessionKey,
  ]);

  useEffect(() => {
    if (!enableHttpPersistence || !onLocalYjsState) {
      return;
    }
    const handleUpdate = () => {
      onLocalYjsState(Y.encodeStateAsUpdate(ydoc));
    };
    ydoc.on("update", handleUpdate);
    return () => {
      ydoc.off("update", handleUpdate);
    };
  }, [enableHttpPersistence, onLocalYjsState, ydoc]);

  const awareness = externalAwareness ?? provider?.awareness ?? null;

  return (
    <WhiteboardSurface
      ydoc={ydoc}
      scope={{ type: "document" }}
      awareness={awareness}
      readonly={readonly}
      mode="page"
      className={className}
      localUser={user}
      theme={theme}
      langCode={langCode}
      localSyncReady={collabConfig ? collabSynced : true}
    />
  );
}
