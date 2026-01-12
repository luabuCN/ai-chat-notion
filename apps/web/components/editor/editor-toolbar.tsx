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
  isOwner?: boolean; // 是否是文档所有者
}

export function EditorToolbar({
  visible,
  hasIcon,
  hasCover,
  onAddIcon,
  onAddCover,
  onAddComment,
  isOwner = true, // 默认为 true，保持向后兼容
}: EditorToolbarProps) {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* 添加图标 - 仅所有者可见 */}
      {!hasIcon && isOwner && (
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
      {/* 添加封面 - 仅所有者可见 */}
      {!hasCover && isOwner && (
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
      {/* 添加评论 - 所有人可见 */}
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
