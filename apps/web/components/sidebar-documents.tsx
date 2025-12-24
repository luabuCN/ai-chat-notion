"use client";

import { Plus, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
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

export function SidebarDocuments() {
  const router = useRouter();
  const createDocumentMutation = useCreateDocument();
  const [isLabelHovered, setIsLabelHovered] = useState(false);

  const handleAddDocument = () => {
    createDocumentMutation.mutate(
      {
        title: "未命名",
      },
      {
        onSuccess: (res) => {
          router.push(`/editor/${res.id}`);
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
                <Plus
                  className={cn(
                    createDocumentMutation.isPending && "animate-spin"
                  )}
                />
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
