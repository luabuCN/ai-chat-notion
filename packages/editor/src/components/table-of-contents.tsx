"use client";

import { Editor } from "@tiptap/react";
import { List } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

interface TableOfContentsProps {
  editor: Editor | null;
  className?: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ editor, className }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!editor) return;

    const updateToc = () => {
      const newItems: TocItem[] = [];
      const doc = editor.state.doc;
      const idCounts: Record<string, number> = {};

      doc.descendants((node) => {
        // 识别所有标题级别 (1, 2, 3)
        if (node.type.name === "heading" && node.attrs.level <= 3) {
          let id = node.textContent
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w\u4e00-\u9fa5-]/g, ""); // Allow Chinese characters in ID

          // 处理重复 ID
          if (idCounts[id]) {
            idCounts[id]++;
            id = `${id}-${idCounts[id]}`;
          } else {
            idCounts[id] = 1;
          }

          newItems.push({
            id,
            text: node.textContent,
            level: node.attrs.level,
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
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px" }
    );

    items.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  // 找到最小的标题级别作为基准（例如只有 H2 和 H3，则 H2 是基准）
  const minLevel = Math.min(...items.map((item) => item.level));

  return (
    <div
      className={cn(
        "hidden xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-50 flex-col items-end gap-2",
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
            {items.map((item, index) => {
              // 根据标题级别计算缩进（相对于最小级别）
              const indent = (item.level - minLevel) * 12;

              return (
                <button
                  key={index}
                  onClick={() => {
                    const element = document.getElementById(item.id);
                    if (element) {
                      element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      setActiveId(item.id);
                    }
                  }}
                  style={{ paddingLeft: `${12 + indent}px` }}
                  className={cn(
                    "text-left py-1.5 pr-3 rounded-md transition-colors truncate w-full",
                    // H1 更大更粗，H2 中等，H3 更小
                    item.level === 1 && "text-sm font-medium",
                    item.level === 2 && "text-xs font-medium",
                    item.level === 3 && "text-xs",
                    activeId === item.id
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
