"use client";

import { useRef, useEffect, KeyboardEvent } from "react";
import TextareaAutosize from "react-textarea-autosize";

interface EditorTitleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function EditorTitle({
  value,
  onChange,
  placeholder = "无标题",
  disabled = false,
}: EditorTitleProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  return (
    <TextareaAutosize
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full resize-none appearance-none overflow-hidden bg-transparent text-4xl font-bold focus:outline-none text-foreground placeholder:text-muted-foreground/50 ${
        disabled ? "cursor-default" : ""
      }`}
    />
  );
}
