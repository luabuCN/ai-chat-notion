"use client";

import Link from "next/link";
import { Loader2, Pause } from "lucide-react";
import { Badge, Button } from "@repo/ui";
import { toast } from "@/components/toast";
import { useWorkspace } from "@/components/workspace-provider";
import { usePendingImageGenerationCount } from "@/lib/image-generation/generation-store";
import { cancelAllBackgroundImagePolls } from "@/lib/image-generation/generation-runner";

export function ImageGenerationProgressIndicator() {
  const pendingCount = usePendingImageGenerationCount();
  const { currentWorkspace } = useWorkspace();

  if (pendingCount === 0) {
    return null;
  }

  const href = currentWorkspace?.slug
    ? `/${currentWorkspace.slug}/image`
    : "/image";

  function handlePauseAll() {
    cancelAllBackgroundImagePolls();
    toast({
      type: "success",
      description: "已暂停后台跟踪，可在历史记录中查看结果",
    });
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-2 pl-4 pr-2 text-sm font-medium text-zinc-900 shadow-lg">
      <Link
        href={href}
        className="flex items-center gap-2 transition hover:text-primary"
      >
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>
          {pendingCount > 1
            ? `${pendingCount} 张图片生成中`
            : "图片生成中"}
        </span>
        <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs">
          后台
        </Badge>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 rounded-full px-3 text-xs text-zinc-600 hover:text-zinc-900"
        onClick={handlePauseAll}
      >
        <Pause className="size-3.5" />
        暂停
      </Button>
    </div>
  );
}
