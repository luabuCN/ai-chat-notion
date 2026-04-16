"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { useSidebarDocumentsContext } from "./sidebar-documents-context";
import Item from "./sidebar-document-item";
import { FileIcon } from "lucide-react";
import type { EditorDocument } from "@repo/database";
import { useSidebarDocuments } from "@/hooks/use-document-query";
import { useWorkspace } from "./workspace-provider";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

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
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const { expanded, onExpand } = useSidebarDocumentsContext();
  const { currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  /** 从他人文档 /editor/[id] 进入时 URL 无 slug，用当前工作区 slug */
  const effectiveWorkspaceSlug =
    workspaceSlug || currentWorkspace?.slug || "";
  const { canEdit } = useWorkspacePermission();

  const {
    data: documents,
    isLoading: isDocumentsLoading,
    error,
  } = useSidebarDocuments(parentDocumentId, currentWorkspace?.id);

  // 当 workspace 还在加载，或者文档还在加载时，都显示加载状态
  const isLoading = isWorkspaceLoading || isDocumentsLoading;

  const onRedirect = (documentId: string) => {
    const path = effectiveWorkspaceSlug
      ? `/${effectiveWorkspaceSlug}/editor/${documentId}`
      : `/editor/${documentId}`;
    router.push(path);
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
      {displayDocuments.map((document) => {
        // 解码 pathname 以正确匹配含中文的 URL
        const decodedPathname = decodeURIComponent(pathname);
        const expectedPath = effectiveWorkspaceSlug
          ? `/${effectiveWorkspaceSlug}/editor/${document.id}`
          : `/editor/${document.id}`;
        const isActive =
          decodedPathname === expectedPath ||
          pathname === `/editor/${document.id}`;

        return (
          <div key={document.id}>
            <Item
              id={document.id}
              onClick={() => onRedirect(document.id)}
              label={document.title}
              icon={FileIcon}
              active={isActive}
              level={level}
              onExpand={() => onExpand(document.id)}
              expanded={expanded[document.id]}
              documentIcon={document.icon}
              canEdit={canEdit}
              lastEditedByName={(document as any).lastEditedByName}
            />
            {expanded[document.id] && (
              <DocumentsList parentDocumentId={document.id} level={level + 1} />
            )}
          </div>
        );
      })}
    </>
  );
};

export default DocumentsList;
