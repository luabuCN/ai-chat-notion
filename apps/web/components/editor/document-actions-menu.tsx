"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  MoreHorizontal,
  FileText,
  Loader2,
  Copy,
  FolderInput,
  Trash2,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import {
  useGetDocument,
  useDuplicateDocument,
  useMoveDocument,
  useArchive,
} from "@/hooks/use-document-query";
import { useEditorExport } from "@repo/editor";
import { DocumentSelectorDialog } from "./document-selector-dialog";
import { toast } from "sonner";

interface DocumentActionsMenuProps {
  documentId: string;
  title: string;
  isOwner?: boolean; // 是否是文档所有者
}

export function DocumentActionsMenu({
  documentId,
  title,
  isOwner = false,
}: DocumentActionsMenuProps) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const { data: document } = useGetDocument(documentId);
  const { exportDocument } = useEditorExport();
  const duplicateMutation = useDuplicateDocument();
  const moveMutation = useMoveDocument();
  const archiveMutation = useArchive();

  const [isExporting, setIsExporting] = useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isLoading =
    isExporting ||
    duplicateMutation.isPending ||
    moveMutation.isPending ||
    archiveMutation.isPending;

  const handleDuplicate = async () => {
    try {
      setIsMenuOpen(false);
      const newDoc = await duplicateMutation.mutateAsync(documentId);
      toast.success("文档已复制");
      // Navigate to the new document
      router.push(`/${workspaceSlug}/editor/${newDoc.id}`);
    } catch (error) {
      toast.error("复制文档失败");
      console.error("Failed to duplicate document:", error);
    }
  };

  const handleMove = async (parentDocumentId: string | null) => {
    try {
      await moveMutation.mutateAsync({ documentId, parentDocumentId });
      toast.success("文档已移动");
      setIsMoveDialogOpen(false);
      setIsMenuOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("移动文档失败");
      console.error("Failed to move document:", error);
    }
  };

  const handleExportMarkdown = async () => {
    if (!document?.content) return;

    try {
      setIsMenuOpen(false);
      setIsExporting(true);
      const content = JSON.parse(document.content);
      await exportDocument(content, title);
      toast.success("导出成功");
    } catch (error) {
      toast.error("导出失败");
      console.error("Failed to export markdown:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleArchive = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    setIsMenuOpen(false);
    try {
      await archiveMutation.mutateAsync(documentId);
      toast.success("文档已移至垃圾箱");
      setTimeout(() => {
        router.push(`/${workspaceSlug}/editor`);
      }, 0);
    } catch (error) {
      toast.error("删除文档失败");
      console.error("Failed to archive document:", error);
    }
  };

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreHorizontal className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/* 仅文档所有者可见：创建副本 */}
          {isOwner && (
            <DropdownMenuItem onClick={handleDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              创建副本
            </DropdownMenuItem>
          )}
          {/* 仅文档所有者可见：移动 */}
          {isOwner && (
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setTimeout(() => setIsMoveDialogOpen(true), 0);
              }}
            >
              <FolderInput className="mr-2 h-4 w-4" />
              移动
            </DropdownMenuItem>
          )}
          {/* 所有人可见：导出 */}
          <DropdownMenuItem onClick={handleExportMarkdown}>
            <FileText className="mr-2 h-4 w-4" />
            导出 Markdown
          </DropdownMenuItem>
          {/* 仅文档所有者可见：移至垃圾箱 */}
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleArchive}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                移至垃圾箱
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentSelectorDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        onSelect={handleMove}
        isLoading={moveMutation.isPending}
        title="移动文档"
        placeholder="将页面移至..."
        excludeDocumentId={documentId}
      />
    </>
  );
}
