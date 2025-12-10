"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
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

  const { data: documents, isLoading } = useSidebarDocuments(parentDocumentId);

  const onRedirect = (documentId: string) => {
    router.push(`/editor/${documentId}`);
  };

  // 使用传入的 data 或从 hook 获取的数据
  const displayDocuments = data ?? documents;

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
    return (
      <p
        style={{
          paddingLeft: level ? `${level * 12 + 25}px` : undefined,
        }}
        className={cn(
          "hidden text-sm font-medium text-muted-foreground/80",
          level === 0 && "hidden"
        )}
      >
        没有文档
      </p>
    );
  }

  return (
    <>
      {displayDocuments.map((document) => (
        <div key={document.id}>
          <Item
            id={document.id}
            onClick={() => onRedirect(document.id)}
            label={document.title}
            icon={FileIcon}
            active={pathname === `/editor/${document.id}`}
            level={level}
            onExpand={() => onExpand(document.id)}
            expanded={expanded[document.id]}
            documentIcon={null}
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

