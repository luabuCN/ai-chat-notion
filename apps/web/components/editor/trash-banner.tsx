"use client";

import { AlertTriangle, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import {
  useRestoreDocument,
  usePermanentDeleteDocument,
  documentKeys,
} from "@/hooks/use-document-query";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

type TrashActionError = Error & {
  code?: string;
  statusCode?: number;
};

interface TrashBannerProps {
  documentId: string;
}

export function TrashBanner({ documentId }: TrashBannerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const restoreMutation = useRestoreDocument();
  const permanentDeleteMutation = usePermanentDeleteDocument();

  const handleTrashActionError = (error: unknown, fallbackMessage: string) => {
    const actionError = error as TrashActionError;
    if (
      actionError.code === "permission_changed" ||
      actionError.statusCode === 403
    ) {
      toast.error("权限已变更", {
        description: "你的文档管理权限已被移除，当前操作无法继续",
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(documentId) });
      return;
    }

    toast.error(fallbackMessage);
  };

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync(documentId);
      toast.success("文档已还原");
      router.push(`/${workspaceSlug}/editor/${documentId}`);
    } catch (error) {
      handleTrashActionError(error, "还原文档失败");
    }
  };

  const handleDeletePermanent = async () => {
    if (confirm("确定要永久删除此文档吗？此操作无法撤销。")) {
      try {
        await permanentDeleteMutation.mutateAsync(documentId);
        toast.success("文档已永久删除");
        router.push(`/${workspaceSlug}/editor`); // Redirect to home/editor list
      } catch (error) {
        handleTrashActionError(error, "永久删除失败");
      }
    }
  };

  return (
    <div className="w-full bg-red-500 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">此页面在垃圾箱中。</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-xs bg-red-600 text-white border-red-400 hover:bg-red-700 hover:text-white"
          onClick={handleRestore}
          disabled={restoreMutation.isPending}
        >
          {restoreMutation.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RotateCcw className="mr-1 h-3 w-3" />
          )}
          还原页面
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-2 text-xs bg-red-600 text-white border-red-400 hover:bg-red-700 hover:text-white"
          onClick={handleDeletePermanent}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          从垃圾箱中删除
        </Button>
      </div>
    </div>
  );
}
