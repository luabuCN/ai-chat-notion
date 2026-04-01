"use client";

import { cn } from "@repo/ui";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

export type ResponseProps = ComponentProps<typeof Streamdown> & {
  /** 用户气泡蓝底：Typography 的 `prose` 会给 `p`/`li` 等单独设色，会盖掉父级 `text-white` */
  variant?: "default" | "user";
};

/** 与主站 `apps/web/components/elements/response.tsx` 对齐：Streamdown 渲染 Markdown / 流式片段。 */
export const Response = memo(
  ({ className, variant = "default", ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        variant === "user"
          ? [
              "prose prose-invert max-w-none text-white",
              "[--tw-prose-body:theme(colors.white)] [--tw-prose-headings:theme(colors.white)] [--tw-prose-bold:theme(colors.white)] [--tw-prose-bullets:theme(colors.white)] [--tw-prose-counters:theme(colors.white)]",
            ]
          : "prose prose-neutral max-w-none dark:prose-invert",
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_pre]:!my-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        "[&_code]:whitespace-pre-wrap [&_code]:wrap-break-word",
        className,
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.variant === nextProps.variant &&
    prevProps.className === nextProps.className,
);

Response.displayName = "Response";
