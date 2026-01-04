"use client";

import { Plus, FileText, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
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
import { SidebarDocumentsProvider } from "./sidebar-documents-context";
import { useWorkspace } from "./workspace-provider";

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
  const createDocumentMutation = useCreateDocument();
  const [isLabelHovered, setIsLabelHovered] = useState(false);

  const handleAddDocument = () => {
    createDocumentMutation.mutate(
      {
        title: "未命名",
        workspaceId: currentWorkspace?.id,
      },
      {
        onSuccess: (res) => {
          router.push(`/${workspaceSlug}/editor/${res.id}`);
          toast.success("新笔记已创建！");
        },
        onError: (error: Error) => {
          toast.error(error.message || "创建新笔记失败");
        },
      }
    );
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel
        onMouseEnter={() => setIsLabelHovered(true)}
        onMouseLeave={() => setIsLabelHovered(false)}
      >
        AI 文档
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <SidebarGroupAction
                onClick={handleAddDocument}
                disabled={createDocumentMutation.isPending}
                className={cn(
                  "transition-opacity",
                  isLabelHovered ? "opacity-100" : "opacity-0",
                  createDocumentMutation.isPending && "opacity-100 cursor-wait"
                )}
              >
                {createDocumentMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus />
                )}
                <span className="sr-only">Add</span>
              </SidebarGroupAction>
            </TooltipTrigger>
            <TooltipContent side="right">
              {createDocumentMutation.isPending ? "创建中..." : "添加文档"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarGroupLabel>
      <SidebarDocumentsProvider>
        <SidebarMenu>
          <DocumentsList />
        </SidebarMenu>
      </SidebarDocumentsProvider>
    </SidebarGroup>
  );
}
