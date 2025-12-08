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

export function SidebarDocuments() {
  const router = useRouter();
  const { trigger: mutate } = useCreateDocument();
  const [isLabelHovered, setIsLabelHovered] = useState(false);

  const handleAddDocument = () => {
    mutate(
      {
        title: "未命名",
      },
      {
        onSuccess: (res) => {
          router.push(`/editor?documentId=${res.id}`);
          toast.success("新笔记已创建！");
          // 触发重新加载
          window.location.reload();
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
                className={cn(
                  "transition-opacity",
                  isLabelHovered ? "opacity-100" : "opacity-0"
                )}
              >
                <Plus />
                <span className="sr-only">Add</span>
              </SidebarGroupAction>
            </TooltipTrigger>
            <TooltipContent side="right">添加文档</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </SidebarGroupLabel>
      <SidebarMenu>
        <DocumentsList />
      </SidebarMenu>
    </SidebarGroup>
  );
}
