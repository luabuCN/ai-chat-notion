"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { RefreshCw, X } from "lucide-react";
import Image from "next/image";

interface EditorCoverProps {
  coverUrl: string | null;
  onChangeCover: () => void;
  onRemoveCover: () => void;
}

export function EditorCover({
  coverUrl,
  onChangeCover,
  onRemoveCover,
}: EditorCoverProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!coverUrl) return null;

  // 判断是否为渐变色
  const isGradient = coverUrl.startsWith("linear-gradient");

  return (
    <div
      className="relative w-full h-[30vh] min-h-[200px] max-h-[300px] group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isGradient ? (
        <div className="w-full h-full" style={{ background: coverUrl }} />
      ) : (
        <Image
          src={coverUrl}
          alt="Cover"
          fill
          className="object-cover"
          priority
        />
      )}
      {/* 悬浮时显示的操作按钮 */}
      <div
        className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-200 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs bg-background/80 hover:bg-background"
          onClick={onChangeCover}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          更换封面
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 text-xs bg-background/80 hover:bg-background"
          onClick={onRemoveCover}
        >
          <X className="h-3 w-3 mr-1" />
          删除封面
        </Button>
      </div>
    </div>
  );
}
