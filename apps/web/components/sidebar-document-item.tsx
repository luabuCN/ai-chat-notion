"use client";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui";
import { Skeleton } from "@repo/ui";
import { cn } from "@/lib/utils";
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
  canEdit?: boolean; // 是否有编辑权限，用于控制操作按钮显示
  lastEditedByName?: string | null; // 最后编辑者名称
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
  const createDocumentMutation = useCreateDocument();
  const archiveMutation = useArchive();
  const [isHovered, setIsHovered] = useState(false);

  const onArchive = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!id) return;
    event.stopPropagation();
    archiveMutation.mutate(id, {
      onSuccess: () => {
        toast.success("笔记已移至回收站！");
        // 如果当前正在查看被删除的文档，重定向到编辑器首页
        if (pathname === `/${workspaceSlug}/editor/${id}`) {
          router.push(`/${workspaceSlug}/editor`);
        }
        router.refresh();
      },
      onError: (error: Error) => {
        toast.error(error.message || "移动到回收站失败");
      },
    });
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
    createDocumentMutation.mutate(
      {
        title: "未命名",
        parentDocumentId: id,
      },
      {
        onSuccess: (res) => {
          // 先展开父文档，这样可以看到新创建的子文档
          if (!expanded) {
            onExpand?.();
          }
          // 延迟导航，确保列表已经更新
          setTimeout(() => {
            router.push(`/${workspaceSlug}/editor/${res.id}`);
          }, 100);
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
  const isActive =
    active || (id && pathname === `/${workspaceSlug}/editor/${id}`);

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
        "group/item relative min-h-[27px] text-sm py-1 w-full hover:bg-primary/5 flex items-center text-muted-foreground font-medium cursor-pointer",
        isHovered ? "pr-12" : "pr-3",
        isActive && " bg-primary/5 text-primary"
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

      <span className="truncate flex-1 min-w-0">{label}</span>
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
              forceMount
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
