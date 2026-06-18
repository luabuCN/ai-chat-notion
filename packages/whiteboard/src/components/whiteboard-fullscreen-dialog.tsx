"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@repo/ui";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { WhiteboardSurface } from "./whiteboard-surface";
import type { WhiteboardScope } from "../types";

type WhiteboardFullscreenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ydoc: Y.Doc;
  scope: WhiteboardScope;
  awareness: Awareness | null;
  readonly?: boolean;
};

export function WhiteboardFullscreenDialog({
  open,
  onOpenChange,
  ydoc,
  scope,
  awareness,
  readonly,
}: WhiteboardFullscreenDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] max-w-[96vw] flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">白板全屏编辑</DialogTitle>
        <div className="min-h-0 flex-1">
          {open ? (
            <WhiteboardSurface
              ydoc={ydoc}
              scope={scope}
              awareness={awareness}
              readonly={readonly}
              mode="fullscreen"
              height={undefined}
              className="h-full border-0"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
