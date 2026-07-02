"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  MoreHorizontal,
  Trash2,
  Users,
  FolderOpen,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Star,
} from "lucide-react";
import {
  Button,
  Input,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import {
  useAllDocuments,
  useCreateDocument,
  type AllDocumentItem,
} from "@/hooks/use-document-query";
import { useWorkspace } from "@/components/workspace-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// 来源筛选类型（「我的收藏」为跨来源的条件筛选）
type SourceFilter = "all" | "workspace" | "shared" | "trash" | "favorites";

// 来源信息配置
const sourceConfig: Record<
  AllDocumentItem["source"],
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  workspace: {
    label: "我的空间",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    icon: FolderOpen,
  },
  shared: {
    label: "共享给我",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    icon: Users,
  },
  trash: {
    label: "回收站",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-50 dark:bg-red-950/50",
    icon: Trash2,
  },
};

// 文档名称列：大屏占 50%，随视口变窄逐步缩小占比；其余列固定最小宽度且不换行
const documentNameColClass =
  "min-w-[140px] overflow-hidden w-[38%] sm:w-[42%] md:w-[46%] lg:w-[50%]";
const sourceColClass = "hidden md:table-cell w-[108px] whitespace-nowrap";
const permissionColClass = "hidden lg:table-cell w-[88px] whitespace-nowrap";
const ownerColClass =
  "hidden lg:table-cell w-[140px] whitespace-nowrap overflow-hidden";
const updatedAtColClass = "hidden sm:table-cell w-[104px] whitespace-nowrap";
const actionsColClass = "w-16 shrink-0 whitespace-nowrap text-right";

// 权限 badge
function PermissionBadge({ permission }: { permission: string | null }) {
  if (!permission) return <span className="text-muted-foreground">-</span>;

  const config: Record<string, { label: string; color: string; bgColor: string }> = {
    edit: {
      label: "可编辑",
      color: "text-blue-700 dark:text-blue-300",
      bgColor: "bg-blue-50 dark:bg-blue-950/50",
    },
    view: {
      label: "只读",
      color: "text-amber-700 dark:text-amber-300",
      bgColor: "bg-amber-50 dark:bg-amber-950/50",
    },
  };

  const c = config[permission] || {
    label: permission,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium",
        c.color,
        c.bgColor
      )}
    >
      {c.label}
    </span>
  );
}

// 来源 badge
function SourceBadge({ source }: { source: AllDocumentItem["source"] }) {
  const config = sourceConfig[source];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-medium",
        config.color,
        config.bgColor
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

// 格式化时间
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  // 更久的显示日期
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  if (date.getFullYear() === now.getFullYear()) {
    return `${month}-${day}`;
  }
  return `${date.getFullYear()}-${month}-${day}`;
}

// 文档行（支持树状展开）
function DocumentRow({
  doc,
  level = 0,
  workspaceId,
  workspaceSlug,
}: {
  doc: AllDocumentItem;
  level?: number;
  workspaceId?: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const {
    data: children,
    isLoading: childrenLoading,
  } = useAllDocuments(
    workspaceId,
    expanded ? doc.id : undefined
  );

  // 点击跳转到文档编辑器
  const handleClick = useCallback(() => {
    if (doc.source === "shared") {
      // 分享文档跳转不带 workspace slug
      router.push(`/editor/${doc.id}`);
    } else {
      router.push(`/${workspaceSlug}/editor/${doc.id}`);
    }
  }, [doc.id, doc.source, workspaceSlug, router]);

  // 切换展开
  const toggleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    []
  );

  return (
    <>
      <TableRow
        className="group cursor-pointer hover:bg-muted/50"
        onClick={handleClick}
      >
        {/* 文档名称 */}
        <TableCell className={documentNameColClass}>
          <div
            className="flex items-center gap-2 min-w-0 overflow-hidden"
            style={{ paddingLeft: `${level * 24}px` }}
          >
            {/* 展开/折叠箭头 */}
            {doc.hasChildren ? (
              <button
                type="button"
                onClick={toggleExpand}
                className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-5" />
            )}

            {/* 图标 */}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/60">
              {doc.icon ? (
                <span className="text-sm">{doc.icon}</span>
              ) : (
                <FileText className="size-3.5 text-muted-foreground" />
              )}
            </span>

            {/* 标题 */}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium",
                doc.source === "trash" && "line-through text-muted-foreground"
              )}
              title={doc.title || "未命名"}
            >
              {doc.title || "未命名"}
            </span>
          </div>
        </TableCell>

        {/* 来源 */}
        <TableCell className={sourceColClass}>
          <SourceBadge source={doc.source} />
        </TableCell>

        {/* 权限 */}
        <TableCell className={permissionColClass}>
          <PermissionBadge permission={doc.permission} />
        </TableCell>

        {/* 所有者/空间 */}
        <TableCell className={ownerColClass}>
          <span className="block truncate text-sm text-muted-foreground">
            {doc.ownerName || "-"}
          </span>
        </TableCell>

        {/* 更新时间 */}
        <TableCell className={updatedAtColClass}>
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatTime(doc.updatedAt)}
          </span>
        </TableCell>

        {/* 操作 */}
        <TableCell className={actionsColClass}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleClick}>
                打开文档
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* 子文档 */}
      {expanded && (
        <>
          {childrenLoading ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="p-0">
                <div
                  className="flex items-center gap-2 px-4 py-2 text-muted-foreground text-sm"
                  style={{ paddingLeft: `${(level + 1) * 24 + 16}px` }}
                >
                  <Loader2 className="size-3.5 animate-spin" />
                  加载中...
                </div>
              </TableCell>
            </TableRow>
          ) : (
            children?.map((child) => (
              <DocumentRow
                key={child.id}
                doc={child}
                level={level + 1}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
              />
            ))
          )}
        </>
      )}
    </>
  );
}

// 表格骨架屏
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-6 rounded" />
              <Skeleton
                className="h-4 rounded-full"
                style={{
                  width: `${120 + Math.random() * 100}px`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            </div>
          </TableCell>
          <TableCell className={sourceColClass}>
            <Skeleton className="h-5 w-16 rounded-full" />
          </TableCell>
          <TableCell className={permissionColClass}>
            <Skeleton className="h-5 w-12 rounded-full" />
          </TableCell>
          <TableCell className={ownerColClass}>
            <Skeleton className="h-4 w-20 rounded" />
          </TableCell>
          <TableCell className={updatedAtColClass}>
            <Skeleton className="h-4 w-16 rounded" />
          </TableCell>
          <TableCell className={actionsColClass}>
            <Skeleton className="h-7 w-7 rounded ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// 筛选按钮
function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// 主组件
export function AllDocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]!
      : "";

  const { currentWorkspace } = useWorkspace();
  const createDocumentMutation = useCreateDocument();

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [updatedAtOrder, setUpdatedAtOrder] = useState<"asc" | "desc" | null>(
    null
  );

  // 获取数据
  const {
    data: allDocs,
    isLoading,
    error,
  } = useAllDocuments(currentWorkspace?.id);

  // 筛选逻辑
  const filteredDocs = useMemo(() => {
    if (!allDocs) return [];

    let filtered = allDocs;

    // 按来源 / 收藏筛选
    if (sourceFilter === "favorites") {
      filtered = filtered.filter((doc) => doc.isFavorite);
    } else if (sourceFilter !== "all") {
      filtered = filtered.filter((doc) => doc.source === sourceFilter);
    }

    // 按搜索关键词筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(query) ||
          doc.ownerName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allDocs, sourceFilter, searchQuery]);

  const displayedDocs = useMemo(() => {
    if (!updatedAtOrder) return filteredDocs;
    const next = [...filteredDocs];
    next.sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return updatedAtOrder === "desc" ? tb - ta : ta - tb;
    });
    return next;
  }, [filteredDocs, updatedAtOrder]);

  const toggleUpdatedAtSort = useCallback(() => {
    setUpdatedAtOrder((prev) => {
      if (prev === null) return "desc";
      if (prev === "desc") return "asc";
      return "desc";
    });
  }, []);

  // 新建文档
  const handleCreateDocument = useCallback(() => {
    createDocumentMutation.mutate(
      {
        title: "未命名",
        workspaceId: currentWorkspace?.id,
      },
      {
        onSuccess: (res) => {
          const path = workspaceSlug
            ? `/${workspaceSlug}/editor/${res.id}`
            : `/editor/${res.id}`;
          router.push(path);
          toast.success("新文档已创建！");
        },
        onError: (error: Error) => {
          toast.error(error.message || "创建文档失败");
        },
      }
    );
  }, [createDocumentMutation, currentWorkspace?.id, workspaceSlug, router]);

  // 各来源的数量
  const sourceCounts = useMemo(() => {
    if (!allDocs)
      return { all: 0, workspace: 0, shared: 0, trash: 0, favorites: 0 };
    return {
      all: allDocs.length,
      workspace: allDocs.filter((d) => d.source === "workspace").length,
      shared: allDocs.filter((d) => d.source === "shared").length,
      trash: allDocs.filter((d) => d.source === "trash").length,
      favorites: allDocs.filter((d) => d.isFavorite).length,
    };
  }, [allDocs]);

  return (
    <div className="relative h-screen flex-1 flex flex-col bg-background">
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面头部 */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">所有文档</h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理和浏览你的全部文档
              </p>
            </div>
            <Button
              onClick={handleCreateDocument}
              disabled={createDocumentMutation.isPending}
              className="gap-1.5"
            >
              {createDocumentMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              新建文档
            </Button>
          </div>

          {/* 筛选栏 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
            {/* 搜索 */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="搜索文档标题、内容或作者..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            {/* 来源筛选 */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton
                active={sourceFilter === "all"}
                onClick={() => setSourceFilter("all")}
              >
                全部 ({sourceCounts.all})
              </FilterButton>
              <FilterButton
                active={sourceFilter === "workspace"}
                onClick={() => setSourceFilter("workspace")}
              >
                <FolderOpen className="size-3" />
                我的空间 ({sourceCounts.workspace})
              </FilterButton>
              <FilterButton
                active={sourceFilter === "shared"}
                onClick={() => setSourceFilter("shared")}
              >
                <Users className="size-3" />
                共享给我 ({sourceCounts.shared})
              </FilterButton>
              <FilterButton
                active={sourceFilter === "favorites"}
                onClick={() => setSourceFilter("favorites")}
              >
                <Star className="size-3" />
                我的收藏 ({sourceCounts.favorites})
              </FilterButton>
              <FilterButton
                active={sourceFilter === "trash"}
                onClick={() => setSourceFilter("trash")}
              >
                <Trash2 className="size-3" />
                回收站 ({sourceCounts.trash})
              </FilterButton>
            </div>
          </div>

          {/* 表格 */}
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-notion-card">
            <Table className="table-fixed min-w-[640px]">
              <TableHeader className="bg-muted/40 [&_tr]:hover:bg-transparent">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead scope="col" className={documentNameColClass}>
                    文档名称
                  </TableHead>
                  <TableHead scope="col" className={sourceColClass}>
                    来源
                  </TableHead>
                  <TableHead scope="col" className={permissionColClass}>
                    权限
                  </TableHead>
                  <TableHead scope="col" className={ownerColClass}>
                    所有者 / 空间
                  </TableHead>
                  <TableHead
                    scope="col"
                    className={updatedAtColClass}
                    aria-sort={
                      updatedAtOrder === "desc"
                        ? "descending"
                        : updatedAtOrder === "asc"
                          ? "ascending"
                          : "none"
                    }
                  >
                    <button
                      type="button"
                      onClick={toggleUpdatedAtSort}
                      className={cn(
                        "-ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-1 text-left text-inherit transition-colors",
                        "hover:bg-muted/80 hover:text-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                        updatedAtOrder !== null && "text-foreground"
                      )}
                    >
                      更新时间
                      <span className="inline-flex text-muted-foreground">
                        {updatedAtOrder === "desc" ? (
                          <ArrowDown
                            className="size-3.5 shrink-0 text-foreground/80"
                            aria-hidden
                          />
                        ) : updatedAtOrder === "asc" ? (
                          <ArrowUp
                            className="size-3.5 shrink-0 text-foreground/80"
                            aria-hidden
                          />
                        ) : (
                          <ArrowUpDown className="size-3.5 shrink-0 opacity-55" aria-hidden />
                        )}
                      </span>
                    </button>
                  </TableHead>
                  <TableHead scope="col" className={actionsColClass}>
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton />
                ) : error ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 py-6">
                        <FileText className="size-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          加载失败
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {error instanceof Error
                            ? error.message
                            : "无法加载文档列表"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDocs.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 py-6">
                        <FileText className="size-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          {searchQuery || sourceFilter !== "all"
                            ? sourceFilter === "favorites"
                              ? "暂无收藏的文档"
                              : "没有找到匹配的文档"
                            : "还没有文档"}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {searchQuery || sourceFilter !== "all"
                            ? sourceFilter === "favorites"
                              ? "在编辑器标题栏收藏文档后会显示在这里"
                              : "尝试修改搜索条件或筛选项"
                            : "点击「新建文档」开始创作"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedDocs.map((doc) => (
                    <DocumentRow
                      key={doc.id}
                      doc={doc}
                      workspaceId={currentWorkspace?.id}
                      workspaceSlug={workspaceSlug}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 底部统计 */}
          {!isLoading && !error && (
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-xs text-muted-foreground">
                共 {filteredDocs.length} 项
                {filteredDocs.length !== (allDocs?.length ?? 0) &&
                  ` (总计 ${allDocs?.length ?? 0} 项)`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
