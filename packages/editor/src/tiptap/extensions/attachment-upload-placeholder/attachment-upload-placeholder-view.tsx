"use client";

import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { FileIcon, Loader2Icon, PaperclipIcon } from "lucide-react";
import type { DragEvent } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { AttachmentUploadPlaceholderOptions } from "./attachment-upload-placeholder";

export function AttachmentUploadPlaceholderView({
  editor,
  extension,
  getPos,
}: NodeViewProps) {
  const options = extension.options as AttachmentUploadPlaceholderOptions;
  const uploadFile = options.uploadFile;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");

  const replaceWithAttachment = (
    url: string,
    fileName: string,
    fileSize?: number,
    fileType?: string
  ) => {
    const pos = getPos();
    if (typeof pos !== "number" || pos < 0) {
      return;
    }

    editor
      .chain()
      .focus()
      .command(({ tr, state }) => {
        const current = state.doc.nodeAt(pos);
        if (!current || current.type.name !== "attachmentUploadPlaceholder") {
          return false;
        }
        const attachmentType = state.schema.nodes.attachment;
        if (!attachmentType) {
          return false;
        }
        tr.replaceWith(
          pos,
          pos + current.nodeSize,
          attachmentType.create({
            url,
            fileName: fileName || "attachment",
            fileSize: fileSize ?? null,
            fileType: fileType ?? null,
          })
        );
        return true;
      })
      .run();
  };

  const handleFiles = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    if (!uploadFile) {
      toast.error("未配置上传接口，请使用下方链接嵌入");
      return;
    }

    setUploading(true);
    try {
      const url = await uploadFile(file);
      replaceWithAttachment(url, file.name, file.size, file.type);
    } catch {
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
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

  const handleEmbedSubmit = () => {
    const trimmed = embedUrl.trim();
    if (!trimmed) {
      return;
    }
    const rawName =
      trimmed.split("/").pop()?.split("?").at(0) || "attachment";
    let displayName = rawName;
    try {
      displayName = decodeURIComponent(rawName);
    } catch {
      displayName = rawName;
    }
    replaceWithAttachment(trimmed, displayName);
    setEmbedUrl("");
  };

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper className="attachment-upload-placeholder">
        <div className="my-2 flex items-center gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          <PaperclipIcon className="size-4 shrink-0" aria-hidden />
          <span>附件（只读）</span>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="attachment-upload-placeholder">
      <div
        className={`my-2 rounded-lg border px-3 py-2.5 transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/15"
        } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={(e) => {
            void handleFiles(e.target.files);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {uploading ? (
            <>
              <Loader2Icon
                className="size-4 shrink-0 animate-spin text-muted-foreground"
                aria-hidden
              />
              <span className="text-sm text-muted-foreground">上传中…</span>
            </>
          ) : (
            <>
              <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-sm text-muted-foreground">
                拖拽文件到此处，或选择本地文件
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                disabled={!uploadFile}
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件
              </Button>
              {!uploadFile ? (
                <span className="text-xs text-muted-foreground">
                  （未配置上传，可用链接嵌入）
                </span>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
          <Input
            placeholder="或通过文件链接嵌入（https://…）"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleEmbedSubmit();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!embedUrl.trim()}
            onClick={handleEmbedSubmit}
          >
            嵌入链接
          </Button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
