"use client";

import { AlertTriangle, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Button } from "@repo/ui";
import {
  useRestoreDocument,
  usePermanentDeleteDocument,
} from "@/hooks/use-document-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface TrashBannerProps {
  documentId: string;
}

export function TrashBanner({ documentId }: TrashBannerProps) {
  const router = useRouter();
  const restoreMutation = useRestoreDocument();
  const permanentDeleteMutation = usePermanentDeleteDocument();

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync(documentId);
      toast.success("文档已还原");
      router.push(`/editor/${documentId}`);
    } catch (error) {
      toast.error("还原文档失败");
    }
  };

  const handleDeletePermanent = async () => {
    if (confirm("确定要永久删除此文档吗？此操作无法撤销。")) {
      try {
        await permanentDeleteMutation.mutateAsync(documentId);
        toast.success("文档已永久删除");
        router.push("/editor"); // Redirect to home/editor list
      } catch (error) {
        toast.error("永久删除失败");
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
