"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { useImageHistory } from "@/components/image/actions";
import type { HistoryItem } from "@/components/image/types";
import {
  EDITOR_SELECT_FROM_MATERIAL_LIBRARY,
  type MaterialLibrarySelectDetail,
} from "@repo/editor";

export function MaterialLibraryDialog() {
  const { currentWorkspace } = useWorkspace();
  const workspaceSlug = currentWorkspace?.slug;
  const [open, setOpen] = useState(false);
  const [onSelect, setOnSelect] = useState<((url: string) => void) | null>(null);

  const { data: history = [], isLoading } = useImageHistory(
    workspaceSlug,
    workspaceSlug ? "workspace" : "user"
  );

  const handleEvent = useCallback((e: Event) => {
    const { onSelect: callback } = (e as CustomEvent<MaterialLibrarySelectDetail>)
      .detail;
    setOnSelect(() => callback);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(
      EDITOR_SELECT_FROM_MATERIAL_LIBRARY,
      handleEvent
    );
    return () => {
      window.removeEventListener(
        EDITOR_SELECT_FROM_MATERIAL_LIBRARY,
        handleEvent
      );
    };
  }, [handleEvent]);

  const handleSelect = (item: HistoryItem) => {
    if (item.outputImageUrl && onSelect) {
      onSelect(item.outputImageUrl);
      setOpen(false);
      setOnSelect(null);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOnSelect(null);
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{"从素材库选择图片"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-500">
          {currentWorkspace
            ? `当前空间：${currentWorkspace.name}`
            : "当前空间 AI 生成的历史图片"}
        </p>
        {isLoading ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-zinc-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <p className="text-sm text-zinc-500">
              {"暂无历史图片，请先在 AI 创作工坊生成"}
            </p>
          </div>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto md:grid-cols-4">
            {history
              .filter((item) => item.outputImageUrl)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 transition hover:border-zinc-400"
                  onClick={() => handleSelect(item)}
                >
                  <img
                    src={item.outputImageUrl!}
                    alt={item.prompt}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
