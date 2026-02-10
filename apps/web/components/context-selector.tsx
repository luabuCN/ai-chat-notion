"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  Button,
} from "@repo/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui";
import { AtSign, Check, FileText, Loader2 } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { useSidebarDocuments } from "@/hooks/use-document-query";
import { cn } from "@/lib/utils";

// 选中文档的精简类型
export interface SelectedDocument {
  id: string;
  title: string;
  icon: string | null;
}

interface ContextSelectorProps {
  onSelect: (doc: SelectedDocument) => void;
  selectedDocIds: string[];
  disabled?: boolean;
}

function PureContextSelector({
  onSelect,
  selectedDocIds,
  disabled = false,
}: ContextSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { currentWorkspace } = useWorkspace();

  // 获取当前 workspace 下的文档列表
  const { data: documents, isLoading } = useSidebarDocuments(
    undefined,
    currentWorkspace?.id
  );

  // 根据搜索关键词过滤文档
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    if (!search.trim()) return documents;
    const keyword = search.toLowerCase();
    return documents.filter((doc) => doc.title.toLowerCase().includes(keyword));
  }, [documents, search]);

  const handleSelect = useCallback(
    (doc: SelectedDocument) => {
      onSelect(doc);
    },
    [onSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                className={cn(
                  "aspect-square h-8 rounded-lg p-1 transition-colors hover:bg-accent",
                  selectedDocIds.length > 0 &&
                    "bg-accent text-accent-foreground hover:bg-accent/80"
                )}
                data-testid="context-selector-trigger"
                disabled={disabled}
                variant="ghost"
              >
                <AtSign size={16} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>添加文档背景</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        side="top"
        sideOffset={8}
      >
        {/* 标题区 */}
        <div className="flex items-center gap-1.5 border-b px-3 py-2 text-xs text-muted-foreground">
          <AtSign size={12} />
          <span>添加背景信息</span>
        </div>

        {/* 搜索框 */}
        <div className="p-2">
          <Input
            autoFocus
            className="h-8 text-sm"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            value={search}
          />
        </div>

        {/* 文档列表 */}
        <div className="max-h-[280px] overflow-y-auto px-1 pb-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              {search ? "没有找到匹配的文档" : "暂无文档"}
            </div>
          ) : (
            <>
              <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase">
                页面
              </div>
              {filteredDocuments.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <button
                    key={doc.id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                      isSelected && "bg-accent/50"
                    )}
                    onClick={() =>
                      handleSelect({
                        id: doc.id,
                        title: doc.title,
                        icon: doc.icon,
                      })
                    }
                    type="button"
                  >
                    {/* 文档图标 */}
                    <span className="flex size-5 shrink-0 items-center justify-center text-sm">
                      {doc.icon || (
                        <FileText size={14} className="text-muted-foreground" />
                      )}
                    </span>

                    {/* 文档标题 */}
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>

                    {/* 选中标记 */}
                    {isSelected && (
                      <Check size={14} className="shrink-0 text-primary" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ContextSelector = memo(PureContextSelector);
