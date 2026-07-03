"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";

type PickerComponent = typeof import("@emoji-mart/react").default;

interface EmojiPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ children, onEmojiSelect }: EmojiPickerProps) {
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState<{
    Picker: PickerComponent;
    data: object;
  } | null>(null);

  useEffect(() => {
    if (!open || picker) {
      return;
    }

    let cancelled = false;

    void Promise.all([
      import("@emoji-mart/react"),
      import("@emoji-mart/data"),
    ]).then(([pickerModule, dataModule]) => {
      if (cancelled) {
        return;
      }

      setPicker({
        Picker: pickerModule.default,
        data: dataModule.default,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [open, picker]);

  const Picker = picker?.Picker;
  const data = picker?.data;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-full p-0 border-none shadow-lg"
        side="bottom"
        align="start"
      >
        {Picker && data ? (
          <Picker
            data={data}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            onEmojiSelect={(emoji: { native: string }) =>
              onEmojiSelect(emoji.native)
            }
            locale="zh"
          />
        ) : (
          <div className="flex h-[350px] w-[352px] items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
