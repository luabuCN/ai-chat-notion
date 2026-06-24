"use client";

import { markdownToTiptap } from "@repo/editor";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace-provider";
import { useCreateDocument } from "@/hooks/use-document-query";
import { apiFetch } from "@/lib/api-client";

export function useGenerateTiptapDocument() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingSource, setPendingSource] = useState<{
    title: string;
    markdown: string;
  } | null>(null);
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
        ? params.slug[0]
        : "";
  const { currentWorkspace } = useWorkspace();
  const createMutation = useCreateDocument();

  const openGenerateDialog = useCallback((title: string, markdown: string) => {
    if (!markdown.trim()) {
      toast.error("没有可生成文档的内容");
      return;
    }

    setPendingSource({ title, markdown });
    setIsDialogOpen(true);
  }, []);

  const handleGenerate = useCallback(
    async (parentDocumentId: string | null) => {
      if (!pendingSource) {
        return;
      }

      try {
        const toastId = toast.loading("正在生成文档...");
        const content = markdownToTiptap(pendingSource.markdown);
        const title = pendingSource.title || "新文档";

        const newDoc = await createMutation.mutateAsync({
          title,
          parentDocumentId: parentDocumentId ?? undefined,
          workspaceId: currentWorkspace?.id,
        });

        await apiFetch(`/api/editor-documents/${newDoc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: JSON.stringify(content) }),
        });

        toast.dismiss(toastId);
        toast.success("文档生成成功");
        setIsDialogOpen(false);
        setPendingSource(null);
        router.push(`/${workspaceSlug}/editor/${newDoc.id}`);
      } catch (error) {
        toast.dismiss();
        toast.error("生成文档失败");
        console.error(error);
      }
    },
    [
      pendingSource,
      createMutation,
      currentWorkspace?.id,
      router,
      workspaceSlug,
    ]
  );

  return {
    isDialogOpen,
    setIsDialogOpen,
    isGenerating: createMutation.isPending,
    openGenerateDialog,
    handleGenerate,
  };
}
