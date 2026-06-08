"use client";

import { code, type CodeHighlighterPlugin } from "@streamdown/code";
import { type FC, memo } from "react";
import { Streamdown as StreamdownBase, type StreamdownProps } from "streamdown";
import { cn } from "@/lib/utils";

type ResponseStreamdownProps = StreamdownProps & {
  plugins?: { code?: CodeHighlighterPlugin };
  animated?: boolean | { animation?: string; duration?: number; easing?: string; sep?: "word" | "char" };
  caret?: "block" | "circle";
};

const Streamdown = StreamdownBase as FC<ResponseStreamdownProps>;

const defaultPlugins = { code };

type ResponseProps = ResponseStreamdownProps;

export const Response = memo(
  ({ className, plugins = defaultPlugins, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:wrap-break-word [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
      plugins={plugins}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.caret === nextProps.caret &&
    prevProps.animated === nextProps.animated
);

Response.displayName = "Response";
