import type { Editor } from "@tiptap/core";
import { MessageSquareTextIcon } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@repo/ui/button";
import { buildMarginCueGeomForPos } from "../../components/comment-prototype/comment-margin-utils";
import { useCommentSelectionHandoffStore } from "../../components/comment-prototype/comment-selection-handoff-store";
import { cn } from "../../lib/utils";

/**
 * 选区气泡内的评论按钮：不写本地 Popover，改为收起选区后由右侧 CommentBlockMarginTrigger 打开同款输入框。
 */
export function CommentBubbleMenuItem({ editor }: { editor: Editor }) {
  const startCommentFromBubbleSelection = useCommentSelectionHandoffStore(
    (state) => state.startCommentFromBubbleSelection
  );

  const onCommentPointerDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const { selection } = editor.state;
    if (selection.empty) {
      return;
    }

    const posAtRangeStart = Math.min(selection.from, selection.to);
    const geom = buildMarginCueGeomForPos(editor.view, posAtRangeStart);
    if (geom) {
      startCommentFromBubbleSelection(geom);
    }

    const caretAt = Math.max(selection.from, selection.to);
    editor.chain().focus().setTextSelection(caretAt).run();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("h-9 gap-1 rounded-none px-2")}
      onPointerDown={onCommentPointerDown}
    >
      <MessageSquareTextIcon className="size-4" aria-hidden />
      <span className="hidden sm:inline whitespace-nowrap text-sm">
        Comment
      </span>
    </Button>
  );
}
