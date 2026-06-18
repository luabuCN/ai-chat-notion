"use client";

import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { ensureBlockState } from "@repo/whiteboard";
import { useEditorCollab } from "../../../context/editor-collab-context";
import { WhiteboardBlockSkeleton } from "./whiteboard-block-skeleton";

const WhiteboardSurface = lazy(() =>
  import("@repo/whiteboard").then((mod) => ({ default: mod.WhiteboardSurface }))
);

export function WhiteboardBlockView({ node }: ReactNodeViewProps) {
  const collab = useEditorCollab();
  const blockId = node.attrs.id as string | null;

  useEffect(() => {
    if (collab?.ydoc && blockId) {
      ensureBlockState(collab.ydoc, blockId);
    }
  }, [blockId, collab?.ydoc]);

  const scope = useMemo(() => {
    if (!blockId) {
      return null;
    }
    return { type: "block" as const, blockId };
  }, [blockId]);

  if (!collab?.ydoc || !scope) {
    return (
      <NodeViewWrapper className="whiteboard-block my-4">
        <WhiteboardBlockSkeleton />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="whiteboard-block my-4">
      <div
        className="w-full"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <Suspense fallback={<WhiteboardBlockSkeleton />}>
          <WhiteboardSurface
            ydoc={collab.ydoc}
            scope={scope}
            awareness={collab.awareness}
            readonly={collab.readonly}
            mode="embed"
            height={360}
          />
        </Suspense>
      </div>
    </NodeViewWrapper>
  );
}
