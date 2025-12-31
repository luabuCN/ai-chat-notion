"use client";

import { useState, useEffect } from "react";
import { ChevronRight, File, Search, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
  DialogDescription,
} from "@repo/ui";
import { useSidebarDocuments } from "@/hooks/use-document-query";
import { cn } from "@repo/ui";
import { useWorkspace } from "../workspace-provider";

interface DocumentTreeItemProps {
  document: {
    id: string;
    title: string;
    icon: string | null;
  };
  selectedId: string | null;
  /** ID to exclude from the list (e.g. current document when moving) */
  excludeId?: string;
  onSelect: (id: string | null) => void;
  level?: number;
}

function DocumentTreeItem({
  document,
  selectedId,
  excludeId,
  onSelect,
  level = 0,
}: DocumentTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentWorkspace } = useWorkspace();
  const { data: children } = useSidebarDocuments(
    document.id,
    currentWorkspace?.id
  );

  const hasChildren = children && children.length > 0;
  const isSelected = selectedId === document.id;
  const isExcluded = document.id === excludeId;
  // If this document is the specific one to exclude, don't render it.
  // Note: We might still want to render its children if we were just disabling selection,
  // but typically "move to self" or "move to descendant" is invalid.
  // For simplicity: if it's the excluded ID, we hide specific logic.
  // However, simpler logic for "Move" is usually: disable self, or hide self.
  if (isExcluded) return null;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group",
          isSelected && "bg-neutral-100 dark:bg-neutral-800"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(document.id)}
      >
        {hasChildren ? (
          <button
            className="p-0.5 hover:bg-muted rounded shrink-0 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        {document.icon ? (
          <span className="text-base shrink-0 opacity-80">{document.icon}</span>
        ) : (
          <File className="h-4 w-4 text-muted-foreground shrink-0 opacity-70" />
        )}
        <span className="text-sm truncate opacity-90">{document.title}</span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <DocumentTreeItem
              key={child.id}
              document={child}
              selectedId={selectedId}
              excludeId={excludeId}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DocumentSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  /** The action to perform when a document (or root) is selected. Null means root. */
  onSelect: (parentDocumentId: string | null) => void;
  /** Optional ID of the document being moved/acted upon, to exclude it from the list */
  excludeDocumentId?: string;
  isLoading?: boolean;
}
export function DocumentSelectorDialog({
  open,
  onOpenChange,
  title,
  description = "选择位置",
  placeholder = "搜索...",
  onSelect,
  excludeDocumentId,
  isLoading = false,
}: DocumentSelectorDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentWorkspace } = useWorkspace();
  const { data: rootDocuments } = useSidebarDocuments(
    undefined,
    currentWorkspace?.id
  );

  useEffect(() => {
    if (open) {
      setSearchQuery("");
    }
  }, [open]);

  const handleSelect = (parentDocumentId: string | null) => {
    if (!isLoading) {
      onSelect(parentDocumentId);
    }
  };

  // Filter documents based on search
  const filteredDocuments = rootDocuments?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* ... */}
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden outline-none">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        {isLoading && (
          <div className="absolute inset-0 z-50 bg-background/50 flex items-center justify-center backdrop-blur-[1px]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Search input - Matching Notion style */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 border-muted bg-neutral-50/50 dark:bg-neutral-900/50 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all rounded"
              autoFocus
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Document list */}
        <div
          className={cn(
            "p-1 max-h-[400px] min-h-[300px] overflow-y-auto",
            isLoading && "opacity-50 pointer-events-none"
          )}
        >
          <div className="text-xs text-muted-foreground px-3 py-2">建议</div>

          {/* Root level option */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded mx-1 transition-colors"
            onClick={() => handleSelect(null)}
          >
            <span className="w-4 shrink-0" />
            <span className="text-base shrink-0 opacity-70">📄</span>
            <span className="text-sm">文档根目录</span>
          </div>

          {/* Document tree */}
          <div className="px-1">
            {filteredDocuments?.map((doc) => (
              <DocumentTreeItem
                key={doc.id}
                document={doc}
                selectedId={null}
                excludeId={excludeDocumentId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
