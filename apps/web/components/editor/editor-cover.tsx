"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@repo/ui";
import { RefreshCw, X, Move } from "lucide-react";
import Image from "next/image";

const CONTAINER_HEIGHT_VH = 100;

interface EditorCoverProps {
  coverUrl: string | null;
  coverImageType?: "color" | "url" | null;
  coverPosition?: number;
  onChangeCover: () => void;
  onRemoveCover: () => void;
  onPositionChange?: (position: number) => void;
}

export function EditorCover({
  coverUrl,
  coverImageType = "url",
  coverPosition = 50,
  onChangeCover,
  onRemoveCover,
  onPositionChange,
}: EditorCoverProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [position, setPosition] = useState(coverPosition);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 判断是否为渐变色或纯色
  const isGradient =
    coverImageType === "color" ||
    (coverUrl
      ? coverUrl.startsWith("linear-gradient") || coverUrl.startsWith("#")
      : false);

  const handleRepositionStart = () => {
    setIsRepositioning(true);
  };

  const handleRepositionEnd = () => {
    setIsRepositioning(false);
    onPositionChange?.(position);
  };

  // 同步外部传入的位置
  useEffect(() => {
    setPosition(coverPosition);
  }, [coverPosition]);

  // 拖拽调整位置
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRepositioning) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setStartY(e.clientY);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRepositioning && e.buttons === 1) {
      e.preventDefault();
      e.stopPropagation();
      const containerHeight = window.innerHeight * (CONTAINER_HEIGHT_VH / 100);
      const deltaY = e.clientY - startY;
      const percentageDelta = (deltaY / containerHeight) * -100;
      const newPosition = Math.max(
        0,
        Math.min(100, position + percentageDelta)
      );
      setPosition(newPosition);
      setStartY(e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isRepositioning) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setStartY(0);
    }
  };

  if (!coverUrl) return null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[30vh] min-h-[200px] max-h-[300px] group overflow-hidden ${
        isRepositioning ? "cursor-move" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {isGradient ? (
        <div className="w-full h-full" style={{ background: coverUrl }} />
      ) : (
        <div className="relative w-full h-full">
          <Image
            src={coverUrl}
            alt="Cover"
            fill
            className="object-cover select-none pointer-events-none"
            style={{
              objectPosition: `center ${position}%`,
            }}
            priority
            unoptimized
            draggable={false}
          />
        </div>
      )}

      {/* 调整位置模式的提示 */}
      {isRepositioning && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <div className="bg-background/90 px-4 py-2 rounded-md text-sm">
            拖拽图片调整位置
          </div>
        </div>
      )}

      {/* 悬浮时显示的操作按钮 */}
      <div
        className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-200 ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
        onPointerDown={(e) => e.stopPropagation()}
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
