"use client";

import Link from "next/link";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  useSidebar,
} from "@repo/ui";
import {
  cn,
  getEditorListPathAfterLeavingDocument,
  isPathnameEditorDocument,
} from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FolderInput,
  Loader2,
  MoreHorizontal,
  Plus,
  Star,
  Trash,
  type LucideIcon,
} from "lucide-react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { toast } from "sonner";
import {
  useCreateDocument,
  useArchive,
  useUpdateDocument,
  useDuplicateDocument,
  useMoveDocument,
} from "@/hooks/use-document-query";
import { useState, useCallback } from "react";
import { useSidebarDocumentsContext } from "./sidebar-documents-context";
import { useWorkspace } from "./workspace-provider";
import { DocumentSelectorDialog } from "./editor/document-selector-dialog";

interface ItemProps {
  id?: string;
  documentIcon?: string | null;
  active?: boolean;
  expanded?: boolean;
  isSearch?: boolean;
  level?: number;
  onExpand?: () => void;
  label: string;
  href?: string;
  icon: LucideIcon;
  canEdit?: boolean;
  isFavorite?: boolean;
  lastEditedByName?: string | null;
}

const Item = ({
  id,
  label,
  href,
  icon: Icon,
  active,
  documentIcon,
  isSearch,
  level = 0,
  expanded,
  onExpand,
  canEdit = true,
  isFavorite = false,
  lastEditedByName,
}: ItemProps) => {
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
  const effectiveWorkspaceSlug =
    workspaceSlug || currentWorkspace?.slug || "";
  const createDocumentMutation = useCreateDocument();
  const archiveMutation = useArchive();
  const updateDocumentMutation = useUpdateDocument();
  const duplicateMutation = useDuplicateDocument();
  const moveMutation = useMoveDocument();
  const { setExpanded: forceExpand } = useSidebarDocumentsContext();
  const { setOpenMobile } = useSidebar();
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isViewingThisDocument = id
    ? isPathnameEditorDocument(pathname, id)
    : false;

  const onArchive = useCallback(
    async (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!id) return;
      e.stopPropagation();

      try {
        await archiveMutation.mutateAsync(id);
        toast.success("笔记已移至回收站！");
        // 如果当前正在查看该文档，跳转到列表页
        if (isViewingThisDocument) {
          const pathNow =
            typeof window !== "undefined" ? window.location.pathname : pathname;
          router.replace(
            getEditorListPathAfterLeavingDocument(
              pathNow,
              effectiveWorkspaceSlug
            )
          );
        } else {
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "移动到回收站失败"
        );
      }
    },
    [id, archiveMutation, isViewingThisDocument, router, pathname, effectiveWorkspaceSlug]
  );

  const onToggleFavorite = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!id) return;
      e.stopPropagation();

      updateDocumentMutation.mutate({
        documentId: id,
        updates: { isFavorite: !isFavorite },
      });
    },
    [id, isFavorite, updateDocumentMutation]
  );

  const onDuplicate = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!id) return;
      e.stopPropagation();

      duplicateMutation.mutate(id, {
        onSuccess: (newDoc) => {
          toast.success("文档已复制");
          router.push(
            effectiveWorkspaceSlug
              ? `/${effectiveWorkspaceSlug}/editor/${newDoc.id}`
              : `/editor/${newDoc.id}`
          );
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "复制文档失败"
          );
        },
      });
    },
    [id, duplicateMutation, router, effectiveWorkspaceSlug]
  );

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!id) return;
      e.stopPropagation();
      setIsMoveDialogOpen(true);
    },
    [id]
  );

  const handleMove = useCallback(
    async (parentDocumentId: string | null) => {
      if (!id) return;

      moveMutation.mutate(
        { documentId: id, parentDocumentId },
        {
          onSuccess: () => {
            toast.success("文档已移动");
            setIsMoveDialogOpen(false);
            router.refresh();
          },
          onError: (error) => {
            toast.error(
              error instanceof Error ? error.message : "移动文档失败"
            );
          },
        }
      );
    },
    [id, moveMutation, router]
  );

  const handleExpand = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    event.stopPropagation();
    onExpand?.();
  };

  const onCreate = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!id) return;

    forceExpand(id);

    createDocumentMutation.mutate(
      {
        title: "未命名",
        parentDocumentId: id,
      },
      {
        onSuccess: (res) => {
          router.push(
            effectiveWorkspaceSlug
              ? `/${effectiveWorkspaceSlug}/editor/${res.id}`
              : `/editor/${res.id}`
          );
          toast.success("新笔记已创建！");
        },
        onError: (error) => {
          const errorMessage =
            error instanceof Error
              ? error.message
              : typeof error === "string"
              ? error
              : "创建新笔记失败";
          toast.error(errorMessage);
        },
      }
    );
  };

  const ChevronIcon = expanded ? ChevronDown : ChevronRight;
  const isActive = active || isViewingThisDocument;

  const rowPadding = {
    paddingLeft: level ? `${level * 12 + 12}px` : "12px",
  };

  const rowClassName = cn(
    "group/item relative flex min-h-[27px] w-full min-w-0 items-center overflow-hidden py-1 text-sm font-medium text-muted-foreground hover:bg-primary/5",
    isActive && "bg-primary/10 text-primary"
  );

  const labelClassName = cn(
    "min-w-0 flex-1 truncate",
    !!id && canEdit && "group-hover/item:pr-14 group-focus-within/item:pr-14",
    isDropdownOpen && "pr-14"
  );

  const iconNode = (
    <div
      role={id ? "button" : undefined}
      tabIndex={id ? 0 : -1}
      className={cn(
        "relative mr-2 h-[18px] w-[18px] shrink-0 text-muted-foreground",
        id && "cursor-pointer"
      )}
      onClick={(event) => {
        if (!id) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        handleExpand(event);
      }}
      onKeyDown={(event) => {
        if (id && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          handleExpand(
            event as unknown as React.MouseEvent<HTMLDivElement, MouseEvent>
          );
        }
      }}
    >
      {id ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-neutral-300 group-hover/item:opacity-100 dark:hover:bg-neutral-600">
          <ChevronIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : null}
      <div
        className={cn(
          "flex h-full w-full items-center justify-center transition-opacity",
          id && "group-hover/item:opacity-0"
        )}
      >
        {documentIcon ? (
          <div className="shrink-0">{documentIcon}</div>
        ) : (
          <Icon className="h-[18px] w-[18px] shrink-0" />
        )}
      </div>
    </div>
  );

  const mainContent = (
    <>
      {iconNode}
      <span className={labelClassName} title={label}>
        {label}
      </span>
    </>
  );

  return (
    <div style={rowPadding} className={rowClassName}>
      {href ? (
        <Link
          href={href}
          className="flex min-w-0 flex-1 cursor-pointer items-center text-sidebar-foreground no-underline [&_svg]:text-sidebar-foreground hover:text-sidebar-accent-foreground hover:[&_svg]:text-sidebar-accent-foreground"
          onClick={() => setOpenMobile(false)}
        >
          {mainContent}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center">{mainContent}</div>
      )}
      {isSearch && (
        <kbd className="ml-2 pointer-events-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className=" text-sx">⌘</span>
          <p className="text-[14px]">k</p>
        </kbd>
      )}

      {!!id && canEdit && (
        <div
          className={cn(
            "absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-x-2 opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100",
            isDropdownOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none group-hover/item:pointer-events-auto group-focus-within/item:pointer-events-auto"
          )}
        >
          <DropdownMenu onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label="更多操作"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className=" w-60"
              align="start"
              side="right"
            >
              <DropdownMenuItem onClick={onToggleFavorite}>
                <Star
                  className={cn(
                    "h-4 w-4 mr-2",
                    isFavorite && "fill-yellow-400 text-yellow-400"
                  )}
                />
                {isFavorite ? "取消收藏" : "收藏"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMove}>
                <FolderInput className="h-4 w-4 mr-2" />
                移动
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} disabled={duplicateMutation.isPending}>
                {duplicateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                复制
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive}>
                <Trash className="h-4 w-4 mr-2" />
                移到回收站
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className=" text-xs text-muted-foreground p-2">
                最后编辑者: {lastEditedByName || "未知"}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onCreate}
            aria-label="新建子文档"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      )}

      <DocumentSelectorDialog
        open={isMoveDialogOpen}
        onOpenChange={setIsMoveDialogOpen}
        onSelect={handleMove}
        isLoading={moveMutation.isPending}
        title="移动文档"
        placeholder="将页面移至..."
        excludeDocumentId={id}
      />
    </div>
  );
};

Item.Skeleton = function ItemSkeleton({ level }: { level?: number }) {
  return (
    <div
      style={{
        paddingLeft: level ? `${level * 12 + 12}px` : "12px",
      }}
      className="flex gap-x-2 py-[3px]"
    >
      <Skeleton className="h-4 w-4 bg-sidebar-foreground/12 dark:bg-sidebar-foreground/15" />
      <Skeleton className="h-4 w-[60%] bg-sidebar-foreground/12 dark:bg-sidebar-foreground/15" />
    </div>
  );
};

export default Item;
