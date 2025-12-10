"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import Item from "./sidebar-document-item";
import { cn } from "@/lib/utils";
import { FileIcon } from "lucide-react";
import type { EditorDocument } from "@repo/database";
import { useSidebarDocuments } from "@/hooks/use-document-query";

interface DocumentsListProps {
  parentDocumentId?: string;
  level?: number;
  data?: EditorDocument[];
}

const DocumentsList = ({
  parentDocumentId,
  level = 0,
  data,
}: DocumentsListProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const onExpand = (documentId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [documentId]: !prev[documentId],
    }));
  };

  // useSidebarDocuments hook 已经内置了监听 document-updated 事件的逻辑，会自动刷新
  const {
    data: documents,
    isLoading,
    error,
  } = useSidebarDocuments(parentDocumentId);

  const onRedirect = (documentId: string) => {
    router.push(`/editor/${documentId}`);
  };

  // 使用传入的 data 或从 hook 获取的数据
  const displayDocuments = data ?? documents;

  // 如果有错误且没有传入的 data，显示空状态而不是崩溃
  if (error && !data) {
    if (level === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <FileIcon className="h-12 w-12 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-muted-foreground/80">
            加载失败
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {error instanceof Error ? error.message : "无法加载文档列表"}
          </p>
        </div>
      );
    }
    return null;
  }

  if (isLoading) {
    return (
      <>
        <Item.Skeleton level={level} />
        {level === 0 && (
          <>
            <Item.Skeleton level={level} />
            <Item.Skeleton level={level} />
          </>
        )}
      </>
    );
  }

  if (!displayDocuments || displayDocuments.length === 0) {
    if (level === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <FileIcon className="h-12 w-12 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-muted-foreground/80">
            还没有文档
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            点击上方 + 号创建第一个文档
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {displayDocuments.map((document) => (
        <div key={`${document.id}-${document.icon ?? ""}-${document.title}`}>
          <Item
            id={document.id}
            onClick={() => onRedirect(document.id)}
            label={document.title}
            icon={FileIcon}
            active={pathname === `/editor/${document.id}`}
            level={level}
            onExpand={() => onExpand(document.id)}
            expanded={expanded[document.id]}
            documentIcon={document.icon}
          />
          {expanded[document.id] && (
            <DocumentsList parentDocumentId={document.id} level={level + 1} />
          )}
        </div>
      ))}
    </>
  );
};

export default DocumentsList;
