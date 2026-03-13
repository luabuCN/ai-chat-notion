import { NodeViewWrapper } from "@tiptap/react";
import { Maximize2 } from "lucide-react";
import { ImagePreview } from "@repo/ui";
import type { NodeViewProps } from "@tiptap/react";
import { cn } from "../../../lib/utils";

export function ImageView({ node, selected }: NodeViewProps) {
  const { src, alt, title } = node.attrs;

  if (!src) {
    return (
      <NodeViewWrapper>
        <div className="rounded border border-dashed border-muted-foreground/30 p-8 text-center text-sm text-muted-foreground">
          {"图片加载失败"}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div
        className={cn(
          "group relative w-fit max-w-full mx-auto",
          selected && "ring-inset ring-primary"
        )}
      >
        <img
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          className="rounded border block max-w-full h-auto"
          draggable={false}
        />
        <div className="absolute right-3 top-3 opacity-60 transition-opacity group-hover:opacity-100">
          <ImagePreview src={src}>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 cursor-pointer"
              title="预览"
              onClick={(e) => e.stopPropagation()}
            >
              <Maximize2 className="size-4" />
            </button>
          </ImagePreview>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
