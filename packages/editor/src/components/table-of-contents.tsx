"use client";

import type { Editor } from "@tiptap/react";
import { List } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface TableOfContentsProps {
  editor: Editor | null;
  className?: string;
}

interface TocItem {
  text: string;
  level: number;
  pos: number;
}

const HEADING_SELECTOR = "h1,h2,h3";

function closestHeading(node: globalThis.Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) {
    if (node.matches(HEADING_SELECTOR)) {
      return node;
    }
    return node.closest(HEADING_SELECTOR);
  }

  if (node instanceof Text) {
    return node.parentElement?.closest(HEADING_SELECTOR) ?? null;
  }

  return null;
}

function getHeadingElement(editor: Editor, pos: number): HTMLElement | null {
  const node = editor.view.nodeDOM(pos);
  const heading = closestHeading(node);

  if (heading) {
    return heading;
  }

  return closestHeading(editor.view.domAtPos(pos + 1).node);
}

export function TableOfContents({ editor, className }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const updateToc = () => {
      const newItems: TocItem[] = [];
      const doc = editor.state.doc;

      doc.descendants((node, pos) => {
        // 识别所有标题级别 (1, 2, 3)
        if (node.type.name === "heading" && node.attrs.level <= 3) {
          newItems.push({
            text: node.textContent,
            level: node.attrs.level,
            pos,
          });
        }
      });

      setItems(newItems);
    };

    updateToc();

    editor.on("update", updateToc);

    return () => {
      editor.off("update", updateToc);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const observedPositions = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const pos = observedPositions.get(entry.target);
            if (pos !== undefined) {
              setActivePos(pos);
            }
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );

    for (const item of items) {
      const element = getHeadingElement(editor, item.pos);
      if (element) {
        observedPositions.set(element, item.pos);
        observer.observe(element);
      }
    }

    return () => observer.disconnect();
  }, [editor, items]);

  if (!editor || items.length === 0) return null;

  // 找到最小的标题级别作为基准（例如只有 H2 和 H3，则 H2 是基准）
  const minLevel = Math.min(...items.map((item) => item.level));

  return (
    <div
      className={cn(
        "hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-50 flex-col items-end gap-2",
        className
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div
        className={cn(
          "bg-background/80 backdrop-blur-md border shadow-lg rounded-xl overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "w-64 opacity-100" : "w-10 opacity-60 hover:opacity-100"
        )}
      >
        <div
          className={cn(
            "flex items-center p-2.5",
            isExpanded ? "justify-between" : "justify-center"
          )}
        >
          <div
            className={cn("flex items-center gap-2", !isExpanded && "hidden")}
          >
            <List className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">目录</span>
          </div>
          {!isExpanded && <List className="h-5 w-5 text-muted-foreground" />}
        </div>

        <div
          className={cn(
            "transition-all duration-300 overflow-hidden overflow-y-auto",
            isExpanded ? "max-h-[500px] opacity-100 pb-2" : "max-h-0 opacity-0"
          )}
        >
          <div className="flex flex-col gap-0.5 px-2">
            {items.map((item) => {
              // 根据标题级别计算缩进（相对于最小级别）
              const indent = (item.level - minLevel) * 12;

              return (
                <button
                  key={item.pos}
                  type="button"
                  onClick={() => {
                    const element = getHeadingElement(editor, item.pos);
                    if (element) {
                      element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      setActivePos(item.pos);
                    }
                  }}
                  style={{ paddingLeft: `${12 + indent}px` }}
                  className={cn(
                    "text-left py-1.5 pr-3 rounded-md transition-colors truncate w-full",
                    // H1 更大更粗，H2 中等，H3 更小
                    item.level === 1 && "text-sm font-medium",
                    item.level === 2 && "text-xs font-medium",
                    item.level === 3 && "text-xs",
                    activePos === item.pos
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
