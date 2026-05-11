"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import {
  EDITOR_SHORTCUT_ITEMS,
  EditorShortcutKeysCell,
} from "@/lib/editor-shortcuts-config";
import { ChevronDown, ChevronUp, Keyboard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const SCROLL_CONTAINER_ID = "editor-scroll-container";

function getScrollEl(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID);
}

/**
 * 正文滚动区（#editor-scroll-container）右下角：回到顶部 / 回到底部
 */
export function EditorScrollNav() {
  const [canScroll, setCanScroll] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);

  const updateScrollability = useCallback(() => {
    const el = getScrollEl();
    if (!el) {
      setCanScroll(false);
      return;
    }
    setCanScroll(el.scrollHeight > el.clientHeight + 1);
  }, []);

  useEffect(() => {
    updateScrollability();

    const el = getScrollEl();
    if (!el) {
      return;
    }

    el.addEventListener("scroll", updateScrollability, { passive: true });
    window.addEventListener("resize", updateScrollability);

    const ro = new ResizeObserver(updateScrollability);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollability);
      window.removeEventListener("resize", updateScrollability);
      ro.disconnect();
    };
  }, [updateScrollability]);

  const scrollToTop = useCallback(() => {
    getScrollEl()?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    const scrollEl = getScrollEl();
    if (!scrollEl) {
      return;
    }
    scrollEl.scrollTo({
      top: scrollEl.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed bottom-6 right-4 z-40 flex flex-col gap-2 lg:bottom-8 lg:right-5">
        {canScroll ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              title="回到顶部"
              className="pointer-events-auto size-10 rounded-full border bg-background/90 shadow-md backdrop-blur-sm hover:bg-background cursor-pointer"
              onClick={scrollToTop}
            >
              <ChevronUp className="size-5" aria-hidden />
              <span className="sr-only">回到顶部</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              title="回到底部"
              className="pointer-events-auto size-10 rounded-full border bg-background/90 shadow-md backdrop-blur-sm hover:bg-background cursor-pointer"
              onClick={scrollToBottom}
            >
              <ChevronDown className="size-5" aria-hidden />
              <span className="sr-only">回到底部</span>
            </Button>
          </>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          title="快捷键"
          className="pointer-events-auto size-10 rounded-full border bg-background/90 shadow-md backdrop-blur-sm hover:bg-background cursor-pointer"
          onClick={() => setShortcutsDialogOpen(true)}
        >
          <Keyboard className="size-5" aria-hidden />
          <span className="sr-only">快捷键</span>
        </Button>
      </div>

      <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>快捷键</DialogTitle>
          </DialogHeader>
          <ul className="m-0 list-none space-y-1 p-0 text-sm">
            {EDITOR_SHORTCUT_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    {item.label}
                  </span>
                  <EditorShortcutKeysCell item={item} />
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
