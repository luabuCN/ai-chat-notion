"use client";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Skeleton } from "@repo/ui";
import {
  cn,
  getEditorListPathAfterLeavingDocument,
  isPathnameEditorDocument,
} from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Trash,
  type LucideIcon,
} from "lucide-react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { toast } from "sonner";
import { useCreateDocument, useArchive } from "@/hooks/use-document-query";
import { useState } from "react";
import { useSidebarDocumentsContext } from "./sidebar-documents-context";
import { useWorkspace } from "./workspace-provider";

interface ItemProps {
  id?: string;
  documentIcon?: string | null;
  active?: boolean;
  expanded?: boolean;
  isSearch?: boolean;
  level?: number;
  onExpand?: () => void;
  label: string;
  onClick?: () => void;
  icon: LucideIcon;
  canEdit?: boolean;
  lastEditedByName?: string | null;
}

const Item = ({
  id,
  label,
  onClick,
  icon: Icon,
  active,
  documentIcon,
  isSearch,
  level = 0,
  expanded,
  onExpand,
  canEdit = true, // 默认有编辑权限
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
  const { setExpanded: forceExpand } = useSidebarDocumentsContext();
  const [isHovered, setIsHovered] = useState(false);

  const isViewingThisDocument = id
    ? isPathnameEditorDocument(pathname, id)
    : false;

  const onArchive = async (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (!id) return;
    event.stopPropagation();
    try {
      await archiveMutation.mutateAsync(id);
      toast.success("笔记已移至回收站！");
      const pathNow =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      if (isPathnameEditorDocument(pathNow, id)) {
        router.replace(
          getEditorListPathAfterLeavingDocument(pathNow, effectiveWorkspaceSlug)
        );
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "移动到回收站失败"
      );
    }
  };

  const handleExpand = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    event.stopPropagation();
    onExpand?.();
  };

  const onCreate = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.stopPropagation();
    if (!id) return;

    // 创建前立即展开父级，让 DocumentsList 挂载、query 就位
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

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        paddingLeft: level ? `${level * 12 + 12}px` : "12px",
      }}
      className={cn(
        "group/item relative flex min-h-[27px] w-full min-w-0 cursor-pointer items-center overflow-hidden py-1 pr-20 text-sm font-medium text-muted-foreground hover:bg-primary/5",
        isActive && "bg-primary/10 text-primary"
      )}
    >
      <div
        role={!!id ? "button" : undefined}
        tabIndex={!!id ? 0 : -1}
        className={cn(
          "shrink-0 h-[18px] w-[18px] mr-2 text-muted-foreground relative",
          !!id && "cursor-pointer"
        )}
        onClick={(e) => !!id && handleExpand(e)}
        onKeyDown={(e) => {
          if (!!id && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleExpand(
              e as unknown as React.MouseEvent<HTMLDivElement, MouseEvent>
            );
          }
        }}
      >
        {!!id && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity z-10 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-sm">
            <ChevronIcon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div
          className={cn(
            "h-full w-full flex items-center justify-center transition-opacity",
            !!id && "group-hover/item:opacity-0"
          )}
        >
          {documentIcon ? (
            <div className="shrink-0">{documentIcon}</div>
          ) : (
            <Icon className="shrink-0 h-[18px] w-[18px]" />
          )}
        </div>
      </div>

      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      {isSearch && (
        <kbd className="ml-2 pointer-events-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className=" text-sx">⌘</span>
          <p className="text-[14px]">k</p>
        </kbd>
      )}

      {!!id && canEdit && (
        <div
          className={cn(
            "absolute right-2 flex items-center gap-x-2 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="h-full rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600"
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className=" w-60"
              align="start"
              side="right"
            >
              <DropdownMenuItem onClick={onArchive}>
                <Trash className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className=" text-xs text-muted-foreground p-2">
                最后编辑者: {lastEditedByName || "未知"}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onCreate(
                  e as unknown as React.MouseEvent<HTMLDivElement, MouseEvent>
                );
              }
            }}
            onClick={onCreate}
            className="h-full rounded-sm hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}
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
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-[30%]" />
    </div>
  );
};

export default Item;
