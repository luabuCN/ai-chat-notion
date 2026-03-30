"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  FileText,
  Loader2,
  Search,
  FileIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  cn,
} from "@repo/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { useSidebarDocuments } from "@/hooks/use-document-query";
import {
  TIPTAP_INSERT_DOCUMENT_LINK,
  type InsertDocumentLinkDetail,
} from "@repo/editor";

type SelectCallback = (doc: {
  id: string;
  title: string;
  icon?: string | null;
}) => void;

interface TreeNodeProps {
  document: { id: string; title: string; icon: string | null };
  excludeId?: string;
  onPick: SelectCallback;
  level?: number;
}

function TreeNode({
  document,
  excludeId,
  onPick,
  level = 0,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const { data: children, isLoading } = useSidebarDocuments(
    expanded ? document.id : undefined,
    expanded ? currentWorkspace?.id : undefined
  );

  const isSelf = document.id === excludeId;
  const hasChildren = children && children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all",
          isSelf
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer hover:bg-accent active:bg-accent/80"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        role="button"
        tabIndex={isSelf ? -1 : 0}
        onClick={() => {
          if (!isSelf) {
            onPick({
              id: document.id,
              title: document.title,
              icon: document.icon,
            });
          }
        }}
        onKeyDown={(e) => {
          if (!isSelf && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onPick({
              id: document.id,
              title: document.title,
              icon: document.icon,
            });
          }
        }}
      >
        {/* expand toggle */}
        <span
          role="button"
          tabIndex={-1}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded transition-colors",
            "hover:bg-muted-foreground/15 cursor-pointer"
          )}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((p) => !p);
          }}
        >
          {expanded && isLoading ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronRight
              className={cn(
                "size-3.5 text-muted-foreground transition-transform duration-150",
                expanded && "rotate-90"
              )}
            />
          )}
        </span>

        {/* icon */}
        {document.icon ? (
          <span className="shrink-0 text-base leading-none select-none">
            {document.icon}
          </span>
        ) : (
          <FileIcon className="size-4 shrink-0 text-muted-foreground/60" />
        )}

        {/* title */}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            isSelf && "line-through"
          )}
        >
          {document.title || "未命名"}
        </span>

        {isSelf && (
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            当前
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              document={child}
              excludeId={excludeId}
              onPick={onPick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 弹窗内容：仅在 open=true 时挂载，避免不必要的数据加载 */
function PickerContent({
  excludeId,
  onPick,
}: {
  excludeId?: string;
  onPick: SelectCallback;
}) {
  const { currentWorkspace } = useWorkspace();
  const [search, setSearch] = useState("");

  const { data: rootDocuments, isLoading } = useSidebarDocuments(
    undefined,
    currentWorkspace?.id
  );

  const filtered = search.trim()
    ? rootDocuments?.filter((d) =>
        d.title.toLowerCase().includes(search.toLowerCase())
      )
    : rootDocuments;

  return (
    <>
      {/* search */}
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="搜索文档…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* tree */}
      <div className="max-h-[50vh] min-h-[200px] overflow-y-auto px-1 py-1">
        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 text-muted-foreground">
            <FileText className="size-8 opacity-30" />
            <p className="text-sm">
              {search.trim() ? "未找到匹配文档" : "暂无文档"}
            </p>
          </div>
        ) : (
          filtered.map((doc) => (
            <TreeNode
              key={doc.id}
              document={doc}
              excludeId={excludeId}
              onPick={onPick}
            />
          ))
        )}
      </div>
    </>
  );
}

export function DocumentLinkPickerDialog() {
  const params = useParams();
  const [open, setOpen] = useState(false);
  const [onSelect, setOnSelect] = useState<SelectCallback | null>(null);

  const currentDocumentId =
    typeof params?.id === "string" ? params.id : null;

  const handleEvent = useCallback((e: Event) => {
    const { onSelect: callback } = (
      e as CustomEvent<InsertDocumentLinkDetail>
    ).detail;
    setOnSelect(() => callback);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(TIPTAP_INSERT_DOCUMENT_LINK, handleEvent);
    return () =>
      window.removeEventListener(TIPTAP_INSERT_DOCUMENT_LINK, handleEvent);
  }, [handleEvent]);

  const handlePick: SelectCallback = (doc) => {
    onSelect?.(doc);
    setOpen(false);
    setOnSelect(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setOnSelect(null);
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4 text-primary" />
            插入文档链接
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            选择一篇文档插入引用，点击可跳转
          </DialogDescription>
        </DialogHeader>

        {/* 仅在弹窗打开时渲染树内容，复用 React Query 缓存、不额外请求 */}
        {open && (
          <PickerContent
            excludeId={currentDocumentId ?? undefined}
            onPick={handlePick}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
