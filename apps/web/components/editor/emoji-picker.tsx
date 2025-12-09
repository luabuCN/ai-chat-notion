"use client";

import { useTheme } from "next-themes";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ children, onEmojiSelect }: EmojiPickerProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-full p-0 border-none shadow-lg"
        side="bottom"
        align="start"
      >
        <Picker
          data={data}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          onEmojiSelect={(emoji: { native: string }) =>
            onEmojiSelect(emoji.native)
          }
          locale="zh"
        />
      </PopoverContent>
    </Popover>
  );
}
