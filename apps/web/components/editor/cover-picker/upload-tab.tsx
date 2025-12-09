"use client";

import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UploadTabProps {
  onSelectCover: (url: string) => void;
  onClose: () => void;
}

export function UploadTab({ onSelectCover, onClose }: UploadTabProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();

      // 使用 queueMicrotask 确保状态更新在下一个微任务中执行
      queueMicrotask(() => {
        onSelectCover(data.url);
        onClose();
      });
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="py-4 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full py-2.5 border border-border rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            上传中...
          </span>
        ) : (
          "上传文件"
        )}
      </button>
      <p className="text-sm text-muted-foreground">
        宽于 1500 像素的图片效果最佳。
      </p>
    </div>
  );
}
