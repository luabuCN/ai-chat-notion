"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { EditorPageHeader } from "./editor-page-header";
import { CollaborativeEditorClient } from "./collaborative-editor-client";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { generateUserColor } from "@repo/editor";

interface CollaborativeEditorContentProps {
  locale: string;
  documentId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  accessToken: string;
}

/**
 * 协同编辑器内容组件
 * 使用 WebSocket 实现多人实时协同编辑
 */
export function CollaborativeEditorContent({
  locale,
  documentId,
  userId,
  userName,
  userEmail,
  accessToken,
}: CollaborativeEditorContentProps) {
  const { data: document, isLoading, error } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  const titleDebounced = useDebounce(title, 500);
  const iconDebounced = useDebounce(icon, 500);

  // 只读模式：已删除的文档或只有查看权限
  const isReadOnly =
    !!document?.deletedAt || (document as any)?.accessLevel === "view";

  // 判断是否是文档所有者
  const isOwner = (document as any)?.accessLevel === "owner";

  // 协同服务器 URL
  const collabServerUrl =
    process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || "ws://localhost:1234";

  // 用户信息
  const user = useMemo(
    () => ({
      name: userName || userEmail?.split("@")[0] || "Anonymous",
      color: generateUserColor(userId),
    }),
    [userId, userName, userEmail]
  );

  // 同步文档数据到本地状态
  useEffect(() => {
    if (document) {
      setTitle(document.title ?? "");
      setIcon(document.icon ?? null);

      // 发送文档加载事件
      window.dispatchEvent(
        new CustomEvent("document-loaded", { detail: document })
      );
    }
  }, [document?.id]);

  // 显示错误
  useEffect(() => {
    if (error) {
      toast.error(error.message || "加载文档失败");
    }
  }, [error]);

  // 防抖保存标题（协同编辑时，内容由 WebSocket 同步，只需要保存元数据）
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly ||
      titleDebounced === document.title ||
      titleDebounced === ""
    )
      return;

    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { title: titleDebounced },
      },
      {
        onError: (err) => {
          toast.error(err.message || "更新标题失败");
        },
      }
    );
  }, [titleDebounced, documentId, document?.title, isReadOnly]);

  // 防抖保存图标
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly ||
      iconDebounced === document.icon
    )
      return;

    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { icon: iconDebounced },
      },
      {
        onError: (err) => {
          toast.error(err.message || "更新图标失败");
        },
      }
    );
  }, [iconDebounced, documentId, document?.icon, isReadOnly]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
  }, []);

  const handleIconChange = useCallback((newIcon: string | null) => {
    setIcon(newIcon);
  }, []);

  const handleCoverChange = useCallback(
    async (cover: string | null, coverImageType?: "color" | "url") => {
      if (!documentId) return;

      const type =
        coverImageType ||
        (cover?.startsWith("#") || cover?.startsWith("linear-gradient")
          ? "color"
          : "url");

      updateDocumentMutation.mutate(
        {
          documentId,
          updates: { coverImage: cover, coverImageType: type },
        },
        {
          onError: (err) => {
            toast.error(err.message || "更新封面失败");
          },
        }
      );
    },
    [documentId, updateDocumentMutation.mutate]
  );

  const handleCoverPositionChange = useCallback(
    async (position: number) => {
      if (!documentId) return;

      updateDocumentMutation.mutate(
        {
          documentId,
          updates: { coverImagePosition: Math.round(position) },
        },
        {
          onError: (err) => {
            toast.error(err.message || "更新封面位置失败");
          },
        }
      );
    },
    [documentId, updateDocumentMutation.mutate]
  );

  const handleSynced = useCallback(() => {
    setIsSynced(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsSynced(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-muted-foreground">文档不存在</div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <EditorPageHeader
        initialTitle={title}
        initialIcon={icon}
        initialCover={document?.coverImage ?? null}
        coverImageType={
          (document?.coverImageType as "color" | "url" | null) ?? "url"
        }
        coverPosition={document?.coverImagePosition ?? 50}
        onTitleChange={handleTitleChange}
        onIconChange={handleIconChange}
        onCoverChange={handleCoverChange}
        onCoverPositionChange={handleCoverPositionChange}
        readonly={isReadOnly}
        isOwner={isOwner}
      />

      <div className="max-w-4xl mx-auto px-4 pb-20">
        <CollaborativeEditorClient
          key={documentId}
          documentId={documentId}
          token={accessToken}
          user={user}
          serverUrl={collabServerUrl}
          readonly={isReadOnly}
          onSynced={handleSynced}
          onDisconnect={handleDisconnect}
        />
      </div>
    </div>
  );
}
