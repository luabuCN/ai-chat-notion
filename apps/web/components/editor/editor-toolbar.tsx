"use client";

import { Button } from "@repo/ui";
import { Smile, Image, MessageSquare } from "lucide-react";
import { EmojiPicker } from "./emoji-picker";

interface EditorToolbarProps {
  visible: boolean;
  hasIcon: boolean;
  hasCover: boolean;
  onAddIcon: (emoji: string) => void;
  onAddCover: () => void;
  onAddComment?: () => void;
}

export function EditorToolbar({
  visible,
  hasIcon,
  hasCover,
  onAddIcon,
  onAddCover,
  onAddComment,
}: EditorToolbarProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {!hasIcon && (
        <EmojiPicker onEmojiSelect={onAddIcon}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <Smile className="h-4 w-4 mr-1" />
            添加图标
          </Button>
        </EmojiPicker>
      )}
      {!hasCover && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={onAddCover}
        >
          <Image className="h-4 w-4 mr-1" />
          添加封面
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground hover:text-foreground"
        onClick={onAddComment}
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        添加评论
      </Button>
    </div>
  );
}
