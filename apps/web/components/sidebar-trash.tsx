"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  Search,
  RotateCcw,
  Loader2,
  FileText,
  Eraser,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Skeleton,
} from "@repo/ui";
import {
  useTrashDocuments,
  useRestoreDocument,
  usePermanentDeleteDocument,
} from "@/hooks/use-document-query";
import { toast } from "sonner";
import { EditorDocument } from "@repo/database";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useWorkspace } from "./workspace-provider";
import {
  cn,
  getEditorListPathAfterLeavingDocument,
  isPathnameEditorDocument,
} from "@/lib/utils";

export function SidebarTrash() {
  const router = useRouter();
  const pathname = usePathname();
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
  /** 点击某行后展示操作按钮（无 hover 的设备）；桌面仍主要用 group-hover；Esc / 点外部关闭 */
  const [touchOpenRowId, setTouchOpenRowId] = useState<string | null>(null);

  useEffect(() => {
    if (!touchOpenRowId) {
      return;
    }
    const closeIfOutside = (e: PointerEvent) => {
      const row = document.querySelector(
        `[data-trash-row="${touchOpenRowId}"]`
      );
      if (row && e.target instanceof Node && row.contains(e.target)) {
        return;
      }
      setTouchOpenRowId(null);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTouchOpenRowId(null);
      }
    };
    document.addEventListener("pointerdown", closeIfOutside, true);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      window.removeEventListener("keydown", onEscape);
    };
  }, [touchOpenRowId]);

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
      setTouchOpenRowId(null);
      setIsOpen(false);
      router.push(
        workspaceSlug
          ? `/${workspaceSlug}/editor/${doc.id}`
          : `/editor/${doc.id}`
      );
    } catch (error) {
      toast.error("还原文档失败");
    } finally {
      setRestoringId(null);
    }
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeletePermanent = async (doc: EditorDocument) => {
    try {
      await permanentDeleteMutation.mutateAsync(doc.id);
      toast.success("文档已永久删除");
      setTouchOpenRowId(null);
      const pathNow =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      if (isPathnameEditorDocument(pathNow, doc.id)) {
        router.replace(
          getEditorListPathAfterLeavingDocument(pathNow, workspaceSlug)
        );
      }
    } catch {
      toast.error("永久删除失败");
    }
  };

  const handleDeleteAll = async () => {
    if (!trashDocuments?.length) return;
    setIsDeletingAll(true);
    try {
      const results = await Promise.allSettled(
        trashDocuments.map((doc) => permanentDeleteMutation.mutateAsync(doc.id))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;
      if (failed === 0) {
        toast.success(`已永久删除 ${succeeded} 个文档`);
      } else {
        toast.warning(`${succeeded} 个成功，${failed} 个失败`);
      }
      // 如果当前正在查看垃圾箱内的某个文档，跳出
      const pathNow =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      const wasViewingDeleted = trashDocuments.some((doc) =>
        isPathnameEditorDocument(pathNow, doc.id)
      );
      if (wasViewingDeleted) {
        router.replace(
          getEditorListPathAfterLeavingDocument(pathNow, workspaceSlug)
        );
      }
    } catch {
      toast.error("清空垃圾箱失败");
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Popover
              open={isOpen}
              onOpenChange={(open) => {
                setIsOpen(open);
                if (!open) {
                  setTouchOpenRowId(null);
                }
              }}
            >
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
                className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
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

                {/* 不用 Radix ScrollArea：其 Viewport 易导致长标题撑宽整行，右侧按钮被裁出可视区 */}
                <TooltipProvider delayDuration={300}>
                  <div className="max-h-[300px] min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden">
                    {isLoading ? (
                      <div
                        className="flex min-h-[200px] flex-col gap-2 p-2"
                        role="status"
                        aria-busy="true"
                        aria-live="polite"
                      >
                        <span className="sr-only">正在加载垃圾箱</span>
                        {Array.from({ length: 6 }, (_, i) => (
                          <div
                            key={i}
                            className="grid min-h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-sm px-1 py-0.5"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Skeleton className="size-5 shrink-0 rounded" />
                              <Skeleton
                                className="h-3.5 max-w-[min(100%,14rem)] flex-1 rounded-full"
                                style={{
                                  animationDelay: `${i * 70}ms`,
                                }}
                              />
                            </div>
                            <Skeleton className="h-7 w-7 shrink-0 rounded-md opacity-80" />
                          </div>
                        ))}
                      </div>
                    ) : filteredDocuments?.length === 0 ? (
                      <div className="flex h-[200px] flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
                        <p>垃圾箱是空的</p>
                        {searchQuery && <p>没有找到匹配的文档</p>}
                      </div>
                    ) : (
                      <ul className="w-full min-w-0 list-none p-2">
                        {filteredDocuments?.map((doc) => (
                          <li
                            key={doc.id}
                            className="group grid min-h-9 w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                            data-trash-row={doc.id}
                            onClick={() => {
                              setTouchOpenRowId(doc.id);
                            }}
                          >
                            <button
                              className="flex min-w-0 cursor-pointer items-center gap-2 overflow-hidden text-left"
                              onClick={() => {
                                setIsOpen(false);
                                router.push(
                                  workspaceSlug
                                    ? `/${workspaceSlug}/editor/${doc.id}`
                                    : `/editor/${doc.id}`
                                );
                              }}
                              type="button"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                                {doc.icon ? (
                                  <span className="text-xs">{doc.icon}</span>
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                              </span>
                              <span
                                className="min-w-0 truncate text-muted-foreground transition-colors group-hover:text-foreground"
                                title={doc.title}
                              >
                                {doc.title}
                              </span>
                            </button>
                            <div
                              className={cn(
                                "flex shrink-0 items-center justify-end gap-0.5 transition-opacity",
                                "pointer-events-none opacity-0",
                                "group-hover:pointer-events-auto group-hover:opacity-100",
                                touchOpenRowId === doc.id &&
                                  "pointer-events-auto opacity-100"
                              )}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRestore(doc);
                                    }}
                                    disabled={restoringId === doc.id}
                                    type="button"
                                  >
                                    {restoringId === doc.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">还原</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void handleDeletePermanent(doc);
                                    }}
                                    type="button"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="left">
                                  永久删除
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TooltipProvider>

                <div className="flex items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    超出 30 天的页面将被自动删除
                  </p>
                  {!!trashDocuments?.length && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeletingAll}
                          className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          {isDeletingAll ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Eraser className="h-3 w-3" />
                          )}
                          清空垃圾箱
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>清空垃圾箱</AlertDialogTitle>
                          <AlertDialogDescription>
                            将永久删除垃圾箱中的{" "}
                            <span className="font-medium text-foreground">
                              {trashDocuments.length} 个文档
                            </span>
                            ，此操作无法撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDeleteAll()}
                          >
                            全部删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
