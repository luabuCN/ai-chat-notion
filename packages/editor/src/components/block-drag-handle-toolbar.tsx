import { offset } from "@floating-ui/dom";
import type { Editor } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { GripVerticalIcon, Plus } from "lucide-react";
import type { MouseEvent } from "react";

export type BlockDragHandleToolbarProps = {
  editor: Editor;
  onAddClick: (e: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * 块级拖拽手柄旁的工具条：「+」打开 slash 命令、六点手柄用于拖拽。
 */
export function BlockDragHandleToolbar({
  editor,
  onAddClick,
}: BlockDragHandleToolbarProps) {
  return (
    <DragHandle
      editor={editor}
      className="transition-all duration-300 ease-in-out"
      computePositionConfig={{
        middleware: [offset(20)],
      }}
    >
      <div className="flex items-center gap-1 -ml-2">
        <button
          type="button"
          className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-pointer transition-colors border shadow-sm"
          onClick={onAddClick}
        >
          <Plus className="size-3.5 text-muted-foreground" />
        </button>
        <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-grab transition-colors border shadow-sm">
          <GripVerticalIcon className="size-3.5 text-muted-foreground" />
        </div>
      </div>
    </DragHandle>
  );
}
