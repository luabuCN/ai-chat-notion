"use client";

import { FileText, Loader2, PenTool, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import DocumentsList from "./sidebar-documents-list";
import { useCreateDocument } from "@/hooks/use-document-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getDocumentEditorPath } from "@/lib/document-routes";
import { SidebarDocumentsProvider } from "./sidebar-documents-context";
import { useWorkspace } from "./workspace-provider";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export function SidebarDocuments() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
        ? params.slug[0]
        : "";
  const { currentWorkspace } = useWorkspace();
  const effectiveWorkspaceSlug =
    workspaceSlug || currentWorkspace?.slug || "";
  const { canCreate } = useWorkspacePermission();
  const createDocumentMutation = useCreateDocument();
  const [isLabelHovered, setIsLabelHovered] = useState(false);

  const handleCreate = (kind: "document" | "whiteboard") => {
    createDocumentMutation.mutate(
      {
        title: kind === "whiteboard" ? "未命名白板" : "未命名",
        workspaceId: currentWorkspace?.id,
        kind,
      },
      {
        onSuccess: (res) => {
          router.push(getDocumentEditorPath(res, effectiveWorkspaceSlug));
          toast.success(
            kind === "whiteboard" ? "新白板已创建！" : "新笔记已创建！"
          );
        },
        onError: (error: Error) => {
          toast.error(
            error.message ||
              (kind === "whiteboard" ? "创建白板失败" : "创建新笔记失败")
          );
        },
      }
    );
  };

  return (
    <SidebarGroup className="flex min-h-0 flex-col overflow-hidden">
      <SidebarGroupLabel
        className="flex-shrink-0"
        onMouseEnter={() => setIsLabelHovered(true)}
        onMouseLeave={() => setIsLabelHovered(false)}
      >
        AI 文档
        {canCreate ? (
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <SidebarGroupAction
                      disabled={createDocumentMutation.isPending}
                      className={cn(
                        "transition-opacity",
                        isLabelHovered ? "opacity-100" : "opacity-0",
                        createDocumentMutation.isPending &&
                          "cursor-wait opacity-100"
                      )}
                    >
                      {createDocumentMutation.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      <span className="sr-only">新建</span>
                    </SidebarGroupAction>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {createDocumentMutation.isPending ? "创建中..." : "新建"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem onClick={() => handleCreate("document")}>
                <FileText className="size-4" aria-hidden />
                新建文档
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreate("whiteboard")}>
                <PenTool className="size-4" aria-hidden />
                新建白板
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </SidebarGroupLabel>
      <SidebarDocumentsProvider>
        <SidebarMenu className="overflow-y-auto flex-1">
          <DocumentsList />
        </SidebarMenu>
      </SidebarDocumentsProvider>
    </SidebarGroup>
  );
}
