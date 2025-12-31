"use client";

import { useState } from "react";
import {
  Trash2,
  Search,
  RotateCcw,
  MoreHorizontal,
  Loader2,
  FileText,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  Input,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import {
  useTrashDocuments,
  useRestoreDocument,
  usePermanentDeleteDocument,
} from "@/hooks/use-document-query";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { EditorDocument } from "@repo/database";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useWorkspace } from "./workspace-provider";

export function SidebarTrash() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const { currentWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { data: trashDocuments, isLoading } = useTrashDocuments(
    currentWorkspace?.id
  );
  const restoreMutation = useRestoreDocument();
  const permanentDeleteMutation = usePermanentDeleteDocument();

  // Filter documents based on search query
  const filteredDocuments = trashDocuments?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRestore = async (doc: EditorDocument) => {
    try {
      setRestoringId(doc.id);
      await restoreMutation.mutateAsync(doc.id);
      toast.success("文档已还原");
      setIsOpen(false);
      router.push(`/${workspaceSlug}/editor/${doc.id}`);
    } catch (error) {
      toast.error("还原文档失败");
    } finally {
      setRestoringId(null);
    }
  };

  const handleDeletePermanent = async (doc: EditorDocument) => {
    if (confirm("确定要永久删除此文档吗？此操作无法撤销。")) {
      try {
        await permanentDeleteMutation.mutateAsync(doc.id);
        toast.success("文档已永久删除");
      } catch (error) {
        toast.error("永久删除失败");
      }
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <SidebarMenuButton
                  isActive={isOpen}
                  tooltip="垃圾箱"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 />
                  <span>垃圾箱</span>
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                className="w-[340px] p-0"
              >
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索被移入垃圾箱的页面"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                </div>

                <ScrollArea className="h-[300px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      加载中...
                    </div>
                  ) : filteredDocuments?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-sm text-center">
                      <p>垃圾箱是空的</p>
                      {searchQuery && <p>没有找到匹配的文档</p>}
                    </div>
                  ) : (
                    <div className="p-2">
                      {filteredDocuments?.map((doc) => (
                        <div
                          key={doc.id}
                          className="group flex items-center justify-between h-9 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-sm text-sm"
                        >
                          <div
                            className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer"
                            onClick={() => {
                              setIsOpen(false);
                              router.push(`/${workspaceSlug}/editor/${doc.id}`);
                            }}
                          >
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                              {doc.icon ? (
                                <span className="text-xs">{doc.icon}</span>
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span className="truncate flex-1 text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              {doc.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRestore(doc);
                                    }}
                                    disabled={restoringId === doc.id}
                                  >
                                    {restoringId === doc.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>还原</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeletePermanent(doc)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>永久删除</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground text-center">
                  垃圾箱中超出 30 天的页面将被自动删除
                </div>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
