"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CornerDownLeft,
  FileText,
  Layers,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
} from "@repo/ui";
import { cn } from "@/lib/utils";
import {
  type AllDocumentItem,
  useAllDocuments,
} from "@/hooks/use-document-query";

export interface DocumentSearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  workspaceSlug: string;
}

export function DocumentSearchPalette({
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
}: DocumentSearchPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: allDocs, isLoading } = useAllDocuments(
    workspaceId,
    undefined,
    {
      flat: true,
      enabled: Boolean(workspaceId) && open,
    }
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setActiveIndex(0);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
    };
  }, [open]);

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    if (!allDocs) {
      return map;
    }
    for (const doc of allDocs) {
      map.set(doc.id, doc.title?.trim() || "未命名");
    }
    return map;
  }, [allDocs]);

  const filtered = useMemo(() => {
    if (!allDocs) {
      return [];
    }
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return allDocs;
    }
    return allDocs.filter((doc) => {
      const t = doc.title.toLowerCase();
      const owner = doc.ownerName?.toLowerCase() ?? "";
      return t.includes(trimmed) || owner.includes(trimmed);
    });
  }, [allDocs, query]);

  useEffect(() => {
    setActiveIndex((i) => {
      if (filtered.length === 0) {
        return 0;
      }
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered.length]);

  const openDocument = useCallback(
    (doc: AllDocumentItem) => {
      if (doc.source === "shared") {
        router.push(`/editor/${doc.id}`);
      } else {
        const slug = workspaceSlug.trim();
        if (slug.length > 0) {
          router.push(`/${slug}/editor/${doc.id}`);
        } else {
          router.push(`/editor/${doc.id}`);
        }
      }
      onOpenChange(false);
    },
    [onOpenChange, router, workspaceSlug]
  );

  const handlePaletteKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (filtered.length === 0) {
          return;
        }
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (event.key === "Enter" && filtered.length > 0) {
        event.preventDefault();
        const doc = filtered[activeIndex];
        if (doc) {
          openDocument(doc);
        }
      }
    },
    [activeIndex, filtered, openDocument]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col max-h-[min(480px,70vh)] max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={handlePaletteKeyDown}
      >
        <DialogTitle className="sr-only">文档搜索</DialogTitle>
        <DialogDescription className="sr-only">
          输入关键词筛选文档，使用上下方向键选择，回车打开。
        </DialogDescription>
        <div className="flex items-center gap-2 border-border border-b px-3 py-2.5">
          <Search
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="搜索…"
            className="h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="搜索文档"
          />
          <DialogClose asChild>
            <button
              type="button"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          <p className="px-3 pt-3 pb-1 text-muted-foreground text-xs font-medium tracking-wide">
            最近
          </p>
          {!workspaceId ? (
            <p className="px-3 pb-4 text-muted-foreground text-sm">
              当前文档未关联工作区，无法列出空间内文档。
            </p>
          ) : null}
          {workspaceId && isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              <span className="sr-only">加载中</span>
            </div>
          ) : null}
          {workspaceId && !isLoading && filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-muted-foreground text-sm">
              {query.trim() ? "没有匹配的文档" : "暂无文档"}
            </p>
          ) : null}
          <ul className="m-0 list-none p-0">
            {filtered.map((doc, index) => {
              const isActive = index === activeIndex;
              const parentTitle =
                doc.parentDocumentId != null
                  ? titleById.get(doc.parentDocumentId) ?? "上层文档"
                  : null;

              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    aria-current={isActive ? true : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      isActive ? "bg-muted/80" : "hover:bg-muted/50"
                    )}
                    onClick={() => {
                      openDocument(doc);
                    }}
                    onMouseEnter={() => {
                      setActiveIndex(index);
                    }}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70">
                        {doc.icon ? (
                          <span className="text-base leading-none" aria-hidden>
                            {doc.icon}
                          </span>
                        ) : (
                          <FileText
                            className="size-4 text-muted-foreground"
                            aria-hidden
                          />
                        )}
                      </span>
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          doc.source === "trash" &&
                            "text-muted-foreground line-through"
                        )}
                      >
                        {doc.title?.trim() || "未命名"}
                      </span>
                    </span>
                    <span className="flex max-w-[45%] shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
                      {parentTitle != null && parentTitle.length > 0 ? (
                        <>
                          <Layers className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          <span className="truncate">{parentTitle}</span>
                        </>
                      ) : null}
                      {isActive ? (
                        <CornerDownLeft
                          className="size-3.5 shrink-0 opacity-55"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
