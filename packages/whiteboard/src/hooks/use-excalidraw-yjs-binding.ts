import { useCallback, useEffect, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import * as Y from "yjs";
import { WHITEBOARD_SYNC_ORIGIN } from "../constants";
import type { WhiteboardScope } from "../types";
import {
  elementsFromYMap,
  filesFromYMap,
  getWhiteboardYScope,
  syncElementsToYMap,
  syncFilesToYMap,
} from "../yjs/scope";

type ExcalidrawChangePayload = {
  elements: readonly Record<string, unknown>[];
  files: Record<string, Record<string, unknown>>;
};

export function useExcalidrawYjsBinding(
  ydoc: Y.Doc,
  scope: WhiteboardScope,
  api: ExcalidrawImperativeAPI | null,
  readonly: boolean,
  /** Re-apply Yjs scene after Excalidraw remounts (e.g. theme switch). */
  sceneRefreshKey?: string,
  /**
   * Whether local Excalidraw changes may be written back to Yjs yet.
   * In collaboration, this must stay false until the provider has synced,
   * otherwise the empty canvas mounted before sync would wipe shared content.
   */
  syncReady = true
): {
  onChange: (payload: ExcalidrawChangePayload) => void;
} {
  const isApplyingRemoteRef = useRef(false);
  const syncReadyRef = useRef(syncReady);
  syncReadyRef.current = syncReady;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const applyRemoteToCanvas = useCallback(() => {
    if (!api) {
      return;
    }
    const { elements: yElements, assets: yAssets } = getWhiteboardYScope(
      ydoc,
      scopeRef.current,
      false
    );
    const elements = elementsFromYMap(yElements);
    const files = filesFromYMap(yAssets);
    isApplyingRemoteRef.current = true;
    api.updateScene({
      elements: elements as unknown as Parameters<
        ExcalidrawImperativeAPI["updateScene"]
      >[0]["elements"],
    });
    if (Object.keys(files).length > 0) {
      api.addFiles(
        files as unknown as Parameters<ExcalidrawImperativeAPI["addFiles"]>[0]
      );
    }
    requestAnimationFrame(() => {
      isApplyingRemoteRef.current = false;
    });
  }, [api, ydoc]);

  const scopeDep =
    scope.type === "block" ? `block:${scope.blockId}` : "document";

  useEffect(() => {
    if (!api) {
      return;
    }
    applyRemoteToCanvas();
    const { elements: yElements, assets: yAssets } = getWhiteboardYScope(
      ydoc,
      scopeRef.current,
      true
    );

    const onElementsChange = () => {
      if (isApplyingRemoteRef.current) {
        return;
      }
      applyRemoteToCanvas();
    };

    yElements.observe(onElementsChange);
    yAssets.observe(onElementsChange);

    return () => {
      yElements.unobserve(onElementsChange);
      yAssets.unobserve(onElementsChange);
    };
  }, [api, applyRemoteToCanvas, sceneRefreshKey, scopeDep, syncReady, ydoc]);

  const onChange = useCallback(
    (payload: ExcalidrawChangePayload) => {
      if (readonly || !syncReadyRef.current || isApplyingRemoteRef.current) {
        return;
      }
      const { elements: yElements, assets: yAssets } = getWhiteboardYScope(
        ydoc,
        scopeRef.current,
        true
      );
      syncElementsToYMap(
        ydoc,
        yElements,
        payload.elements,
        WHITEBOARD_SYNC_ORIGIN
      );
      syncFilesToYMap(
        ydoc,
        yAssets,
        payload.files,
        WHITEBOARD_SYNC_ORIGIN
      );
    },
    [readonly, ydoc]
  );

  return { onChange };
}
