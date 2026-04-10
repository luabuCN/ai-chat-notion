"use client";

import Image from "next/image";
import { Button, ImagePreview } from "@repo/ui";
import type { Attachment } from "@/lib/types";
import { Loader } from "./elements/loader";
import { CrossSmallIcon } from "./icons";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;

  const isImage = contentType?.startsWith("image") === true;
  const canPreviewImage = isImage && url.length > 0;
  const useUnoptimized =
    url.startsWith("blob:") ||
    url.startsWith("data:");

  return (
    <div
      className="group relative size-16 overflow-hidden rounded-lg border bg-muted"
      data-testid="input-attachment-preview"
    >
      {canPreviewImage ? (
        <ImagePreview src={url}>
          <button
            aria-label={`全屏查看：${name || "附件"}`}
            className="relative block size-full cursor-zoom-in overflow-hidden p-0"
            type="button"
          >
            <Image
              alt=""
              className="size-full object-cover"
              height={64}
              src={url}
              unoptimized={useUnoptimized}
              width={64}
            />
          </button>
        </ImagePreview>
      ) : isImage && !url ? (
        <div className="flex size-full items-center justify-center text-muted-foreground text-[10px]">
          <span className="sr-only">等待图片</span>
        </div>
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground text-xs">
          File
        </div>
      )}

      {isUploading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/50"
          data-testid="input-attachment-loader"
        >
          <Loader size={16} />
        </div>
      )}

      {onRemove && !isUploading && (
        <Button
          className="absolute top-0.5 right-0.5 z-10 size-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onRemove}
          size="sm"
          variant="destructive"
        >
          <CrossSmallIcon size={8} />
        </Button>
      )}

      <div className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/80 to-transparent px-1 py-0.5 text-[10px] text-white">
        {name}
      </div>
    </div>
  );
};
