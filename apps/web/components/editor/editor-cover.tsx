"use client";

import { useState, useRef } from "react";
import { Button } from "@repo/ui";
import { RefreshCw, X, Move } from "lucide-react";
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
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [position, setPosition] = useState(50); // 0-100, 默认居中
  const containerRef = useRef<HTMLDivElement>(null);

  // 判断是否为渐变色或纯色
  const isGradient = coverUrl
    ? coverUrl.startsWith("linear-gradient") || coverUrl.startsWith("#")
    : false;

  const handleRepositionStart = () => {
    setIsRepositioning(true);
  };

  const handleRepositionEnd = () => {
    setIsRepositioning(false);
  };

  // 滚轮调整位置
  const handleWheel = (e: React.WheelEvent) => {
    if (!isRepositioning) return;

    e.preventDefault();

    // deltaY > 0 向下滚动，position 增加（显示图片更下方的内容）
    // deltaY < 0 向上滚动，position 减少（显示图片更上方的内容）
    const sensitivity = 5; // 调整灵敏度
    setPosition((prev) => {
      const newPosition = prev + (e.deltaY > 0 ? sensitivity : -sensitivity);
      return Math.max(0, Math.min(100, newPosition));
    });
  };

  if (!coverUrl) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[30vh] min-h-[200px] max-h-[300px] group overflow-hidden ${
        isRepositioning ? "cursor-ns-resize" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onWheel={handleWheel}
    >
      {isGradient ? (
        <div className="w-full h-full" style={{ background: coverUrl }} />
      ) : (
        <div className="relative w-full h-full">
          <Image
            src={coverUrl}
            alt="Cover"
            fill
            className="object-cover"
            style={{
              objectPosition: `center ${position}%`,
            }}
            priority
          />
        </div>
      )}

      {/* 调整位置模式的提示 */}
      {isRepositioning && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <div className="bg-background/90 px-4 py-2 rounded-md text-sm">
            滚动滑轮调整位置
          </div>
        </div>
      )}

      {/* 悬浮时显示的操作按钮 */}
      <div
        className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-200 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        {!isGradient && (
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-xs bg-background/80 hover:bg-background"
            onClick={
              isRepositioning ? handleRepositionEnd : handleRepositionStart
            }
          >
            <Move className="h-3 w-3 mr-1" />
            {isRepositioning ? "完成" : "调整位置"}
          </Button>
        )}
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
