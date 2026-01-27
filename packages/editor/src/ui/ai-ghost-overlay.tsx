"use client";

import React from "react";
import type { GhostTextPosition } from "../tiptap/extensions/ai-autocomplete/types";

interface AIGhostOverlayProps {
  /**
   * 要显示的待处理补全文本
   */
  text: string;

  /**
   * Ghost 文本的位置
   */
  position: GhostTextPosition | null;

  /**
   * 是否为深色模式
   */
  isDark?: boolean;

  /**
   * 自定义样式
   */
  style?: React.CSSProperties;

  /**
   * 自定义类名
   */
  className?: string;
}

export function AIGhostOverlay({
  text,
  position,
  isDark = false,
  style = {},
  className = "",
}: AIGhostOverlayProps) {
  if (!text || !position) return null;

  const defaultStyle: React.CSSProperties = {
    position: "absolute",
    top: position.top + "px",
    left: position.left + "px",
    pointerEvents: "none",
    color: isDark ? "#6b7280" : "#9ca3af", // Gray-500 : Gray-400
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    whiteSpace: "pre",
    zIndex: 1,
    userSelect: "none",
    ...style,
  };

  return (
    <div
      className={`ai-ghost-overlay ${className}`}
      style={defaultStyle}
      aria-hidden="true"
      data-testid="ai-ghost-overlay"
    >
      {text}
    </div>
  );
}
