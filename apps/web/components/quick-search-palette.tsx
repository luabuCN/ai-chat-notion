"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CornerDownLeft,
  FileText,
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
import { useChatHistoryQuery } from "@/hooks/use-chat-history-query";
import { useEffectiveWorkspaceSlug } from "@/hooks/use-effective-workspace-slug";
import type { Chat } from "@repo/database";

export interface QuickSearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
}

type SearchItem =
  | { type: "chat"; data: Chat }
  | { type: "document"; data: AllDocumentItem };

export function QuickSearchPalette({
  open,
  onOpenChange,
  workspaceId,
}: QuickSearchPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const workspaceSlug = useEffectiveWorkspaceSlug();

  const { data: chatPages, isLoading: isChatsLoading } = useChatHistoryQuery(
    workspaceSlug || undefined,
    { enabled: open && Boolean(workspaceSlug) }
  );
  const { data: allDocs, isLoading: isDocsLoading } = useAllDocuments(
    workspaceId,
    undefined,
    { flat: true, enabled: open && Boolean(workspaceId) }
  );

  const allChats = useMemo(() => {
    if (!chatPages?.pages) return [];
    return chatPages.pages.flatMap((page) => page.chats);
  }, [chatPages]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const trimmed = query.trim().toLowerCase();

  const DEFAULT_LIMIT = 5;

  const filteredChats = useMemo(() => {
    const list = trimmed
      ? allChats.filter((chat) =>
          chat.title.toLowerCase().includes(trimmed)
        )
      : allChats;
    return trimmed ? list : list.slice(0, DEFAULT_LIMIT);
  }, [allChats, trimmed]);

  const filteredDocs = useMemo(() => {
    if (!allDocs) return [];
    const list = trimmed
      ? allDocs.filter((doc) => doc.title.toLowerCase().includes(trimmed))
      : allDocs;
    return trimmed ? list : list.slice(0, DEFAULT_LIMIT);
  }, [allDocs, trimmed]);

  const items = useMemo((): SearchItem[] => {
    const result: SearchItem[] = [];
    for (const chat of filteredChats) {
      result.push({ type: "chat", data: chat });
    }
    for (const doc of filteredDocs) {
      result.push({ type: "document", data: doc });
    }
    return result;
  }, [filteredChats, filteredDocs]);

  useEffect(() => {
    setActiveIndex((i) => {
      if (items.length === 0) return 0;
      return Math.min(i, items.length - 1);
    });
  }, [items.length]);

  const openItem = useCallback(
    (item: SearchItem) => {
      if (item.type === "chat") {
        router.push(`/${workspaceSlug}/chat/${item.data.id}`);
      } else if (item.data.source === "shared") {
        router.push(`/editor/${item.data.id}`);
      } else {
        const slug = workspaceSlug.trim();
        if (slug.length > 0) {
          router.push(`/${slug}/editor/${item.data.id}`);
        } else {
          router.push(`/editor/${item.data.id}`);
        }
      }
      onOpenChange(false);
    },
    [onOpenChange, router, workspaceSlug]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (items.length === 0) return;
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (event.key === "Enter" && items.length > 0) {
        event.preventDefault();
        const item = items[activeIndex];
        if (item) openItem(item);
      }
    },
    [activeIndex, items, openItem]
  );

  const isLoading = isChatsLoading || isDocsLoading;
  const hasNoResults = filteredChats.length === 0 && filteredDocs.length === 0;

  let globalIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col max-h-[min(480px,70vh)] max-w-xl gap-0 overflow-hidden p-0 sm:max-w-xl"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">快速搜索</DialogTitle>
        <DialogDescription className="sr-only">
          输入关键词搜索对话和文档，使用上下方向键选择，回车打开。
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
            placeholder="搜索对话和文档…"
            className="h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="搜索对话和文档"
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
          {isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              <span className="sr-only">加载中</span>
            </div>
          ) : null}
          {!isLoading && hasNoResults ? (
            <p className="px-3 py-6 text-center text-muted-foreground text-sm">
              {trimmed ? "没有匹配的结果" : "暂无对话和文档"}
            </p>
          ) : null}

          {/* 对话分组 */}
          {filteredChats.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-muted-foreground text-xs font-medium tracking-wide">
                对话
              </p>
              <ul className="m-0 list-none p-0">
                {filteredChats.map((chat) => {
                  const idx = globalIndex++;
                  const isActive = idx === activeIndex;
                  return (
                    <li key={`chat-${chat.id}`}>
                      <button
                        type="button"
                        aria-current={isActive ? true : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isActive ? "bg-muted/80" : "hover:bg-muted/50"
                        )}
                        onClick={() =>
                          openItem({ type: "chat", data: chat })
                        }
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70">
                            <Bot
                              className="size-4 text-muted-foreground"
                              aria-hidden
                            />
                          </span>
                          <span className="truncate text-sm font-medium">
                            {chat.title || "未命名对话"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
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
            </>
          )}

          {/* 文档分组 */}
          {filteredDocs.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-muted-foreground text-xs font-medium tracking-wide">
                文档
              </p>
              <ul className="m-0 list-none p-0">
                {filteredDocs.map((doc) => {
                  const idx = globalIndex++;
                  const isActive = idx === activeIndex;
                  return (
                    <li key={`doc-${doc.id}`}>
                      <button
                        type="button"
                        aria-current={isActive ? true : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          isActive ? "bg-muted/80" : "hover:bg-muted/50"
                        )}
                        onClick={() =>
                          openItem({ type: "document", data: doc })
                        }
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/70">
                            {doc.icon ? (
                              <span
                                className="text-base leading-none"
                                aria-hidden
                              >
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
                        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
