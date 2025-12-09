"use client";

import { useState } from "react";
import { toast } from "sonner";

interface LinkTabProps {
  onSelectCover: (url: string) => void;
  onClose: () => void;
}

export function LinkTab({ onSelectCover, onClose }: LinkTabProps) {
  const [linkUrl, setLinkUrl] = useState("");

  const handleLinkSubmit = () => {
    if (!linkUrl) {
      toast.error("请输入图片链接");
      return;
    }
    onSelectCover(linkUrl);
    setLinkUrl("");
    setTimeout(() => onClose(), 0);
  };

  return (
    <div className="py-4 space-y-4">
      <input
        type="text"
        placeholder="粘贴图片链接..."
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleLinkSubmit();
        }}
        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        type="button"
        onClick={handleLinkSubmit}
        className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-sm text-sm font-medium transition-colors"
      >
        提交
      </button>
      <p className="text-sm text-muted-foreground text-center">
        适用于网络上任何图片。
      </p>
    </div>
  );
}
