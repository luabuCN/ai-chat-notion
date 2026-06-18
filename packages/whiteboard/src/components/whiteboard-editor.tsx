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
import { WhiteboardSurface } from "./whiteboard-surface";

function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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
  className,
}: WhiteboardEditorProps) {
  const isMountedRef = useRef(true);
  const providerGenerationRef = useRef(0);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

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

    return () => {
      providerGenerationRef.current += 1;
      p.disconnect();
      p.destroy();
      setProvider(null);
    };
  }, [
    collabConfig,
    documentId,
    externalAwareness,
    externalYdoc,
    onConnectedUsersChange,
    onConnectionStatusChange,
    user,
    ydoc,
  ]);

  useEffect(() => {
    if (!enableHttpPersistence || collabConfig || !onLocalYjsState) {
      return;
    }
    const handleUpdate = () => {
      onLocalYjsState(Y.encodeStateAsUpdate(ydoc));
    };
    ydoc.on("update", handleUpdate);
    return () => {
      ydoc.off("update", handleUpdate);
    };
  }, [collabConfig, enableHttpPersistence, onLocalYjsState, ydoc]);

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
    />
  );
}
