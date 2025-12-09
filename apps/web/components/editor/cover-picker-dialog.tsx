"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@repo/ui";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { GalleryTab } from "./cover-picker/gallery-tab";
import { UploadTab } from "./cover-picker/upload-tab";
import { LinkTab } from "./cover-picker/link-tab";
import { UnsplashTab } from "./cover-picker/unsplash-tab";
import { ImageIcon } from "lucide-react";

interface CoverPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCover: (url: string) => void;
}

const tabs = [
  { id: "gallery", label: "画廊" },
  { id: "upload", label: "上传" },
  { id: "link", label: "链接" },
  { id: "unsplash", label: "Unsplash", icon: ImageIcon },
];

export function CoverPickerDialog({
  open,
  onOpenChange,
  onSelectCover,
}: CoverPickerDialogProps) {
  const [activeTab, setActiveTab] = useState("gallery");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>选择封面</DialogTitle>
        </VisuallyHidden>
        {/* Notion 风格标签栏 */}
        <div className="flex items-center gap-1 px-3 pt-3 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-3 py-2 text-sm transition-colors relative
                ${
                  activeTab === tab.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <span className="flex items-center gap-1.5">
                {tab.icon && <tab.icon className="h-4 w-4" />}
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
              )}
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <div className="p-4 max-h-[60vh] overflow-auto">
          {activeTab === "gallery" && (
            <GalleryTab
              onSelectCover={onSelectCover}
              onClose={() => onOpenChange(false)}
            />
          )}
          {activeTab === "upload" && (
            <UploadTab
              onSelectCover={onSelectCover}
              onClose={() => onOpenChange(false)}
            />
          )}
          {activeTab === "link" && (
            <LinkTab
              onSelectCover={onSelectCover}
              onClose={() => onOpenChange(false)}
            />
          )}
          {activeTab === "unsplash" && (
            <UnsplashTab
              onSelectCover={onSelectCover}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
