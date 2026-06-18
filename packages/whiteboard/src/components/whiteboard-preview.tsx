"use client";

import { useMemo } from "react";
import type { WhiteboardSurfaceMode } from "../types";
import { createWhiteboardDocFromBase64 } from "../utils/yjs-state";
import { WhiteboardSurface } from "./whiteboard-surface";

export type WhiteboardPreviewProps = {
  yjsStateB64: string | null;
  readonly?: boolean;
  mode?: WhiteboardSurfaceMode;
  className?: string;
  theme?: "light" | "dark";
  langCode?: string;
};

export function WhiteboardPreview({
  yjsStateB64,
  readonly = true,
  mode = "page",
  className,
  theme = "light",
  langCode = "en",
}: WhiteboardPreviewProps) {
  const ydoc = useMemo(
    () => createWhiteboardDocFromBase64(yjsStateB64),
    [yjsStateB64]
  );

  return (
    <WhiteboardSurface
      ydoc={ydoc}
      scope={{ type: "document" }}
      readonly={readonly}
      mode={mode}
      className={className}
      theme={theme}
      langCode={langCode}
    />
  );
}
