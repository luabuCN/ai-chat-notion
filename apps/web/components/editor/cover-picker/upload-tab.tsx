"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFileUploadMutation } from "@/hooks/use-file-upload-mutation";

interface UploadTabProps {
  onSelectCover: (url: string) => void;
  onClose: () => void;
}

export function UploadTab({ onSelectCover, onClose }: UploadTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync, isPending } = useFileUploadMutation();

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }

    try {
      const result = await mutateAsync(file);
      queueMicrotask(() => {
        onSelectCover(result.url);
        onClose();
      });
    } catch {
      // 错误提示由 useFileUploadMutation 的 onError 处理
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
        disabled={isPending}
        className="w-full py-2.5 border border-border rounded-md text-sm text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {isPending ? (
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
