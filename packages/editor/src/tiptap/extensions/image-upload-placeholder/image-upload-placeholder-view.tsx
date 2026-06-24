"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { ImageIcon, Loader2Icon, UploadIcon } from "lucide-react";
import type { DragEvent } from "react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import type { ImageUploadPlaceholderOptions } from "./image-upload-placeholder";

/** 预加载图片，等待其完全加载后再返回 */
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image failed to load"));
    img.src = src;
  });
}

export function ImageUploadPlaceholderView({
  editor,
  extension,
  getPos,
}: NodeViewProps) {
  const options = extension.options as ImageUploadPlaceholderOptions;
  const uploadFile = options.uploadFile;

  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  // 新增：图片加载中状态（上传完成但图片尚未加载完）
  const [imageLoading, setImageLoading] = useState(false);

  const replaceWithImage = (src: string) => {
    const pos = getPos();
    if (typeof pos !== "number" || pos < 0) {
      return;
    }

    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const current = state.doc.nodeAt(pos);
        if (!current || current.type.name !== "imageUploadPlaceholder") {
          return false;
        }
        const imageType = state.schema.nodes.image;
        if (!imageType) {
          return false;
        }
        tr.replaceWith(pos, pos + current.nodeSize, imageType.create({ src }));
        return true;
      })
      .run();
  };

  const handleFiles = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    if (!uploadFile) {
      toast.error("未配置上传能力，请使用下方链接嵌入");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFile(file);
      setUploading(false);
      setImageLoading(true);
      try {
        await preloadImage(url);
      } catch {
        // 预加载失败不阻塞，仍尝试替换
      }
      replaceWithImage(url);
    } catch {
      toast.error("图片上传失败，请重试");
      setUploading(false);
    } finally {
      setImageLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    void handleFiles(e.dataTransfer.files);
  };

  const handleEmbedSubmit = async () => {
    const trimmed = embedUrl.trim();
    if (!trimmed) {
      return;
    }
    setImageLoading(true);
    try {
      await preloadImage(trimmed);
    } catch {
      // 预加载失败不阻塞，仍尝试嵌入
    }
    replaceWithImage(trimmed);
    setEmbedUrl("");
    setImageLoading(false);
  };

  const isLoading = uploading || imageLoading;

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper className="image-upload-placeholder">
        <div className="my-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-6 text-center text-sm text-muted-foreground">
          图片上传区域（只读预览）
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="image-upload-placeholder">
      <div
        className={`my-3 rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 bg-muted/20"
        } ${isLoading ? "pointer-events-none opacity-70" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files);
          }}
        />

        <div className="flex flex-col items-center gap-3 text-center">
          {uploading ? (
            <>
              <Loader2Icon
                className="size-10 text-muted-foreground animate-spin"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">上传中…</p>
            </>
          ) : imageLoading ? (
            <>
              <Loader2Icon
                className="size-10 text-muted-foreground animate-spin"
                aria-hidden
              />
              <p className="text-sm text-muted-foreground">加载图片中…</p>
            </>
          ) : (
            <>
              <ImageIcon
                className="size-10 text-muted-foreground"
                aria-hidden
              />
              <label
                className="cursor-pointer text-sm text-muted-foreground"
                htmlFor={inputId}
              >
                拖拽图片到此处上传
              </label>
              <Button
                type="button"
                size="sm"
                className="gap-1.5"
                disabled={!uploadFile}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="size-4" aria-hidden />
                上传图片
              </Button>
              {!uploadFile ? (
                <p className="text-xs text-muted-foreground">
                  当前环境未提供上传接口，请使用链接嵌入
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
          <Input
            placeholder="或通过图片链接嵌入（https://…）"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleEmbedSubmit();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 sm:w-auto"
            disabled={!embedUrl.trim() || isLoading}
            onClick={() => {
              void handleEmbedSubmit();
            }}
          >
            嵌入链接
          </Button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}