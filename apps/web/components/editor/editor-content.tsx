"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { EditorPageHeader } from "./editor-page-header";
import { EditorClient } from "./editor-client";
import { CollaborativeEditorClient } from "./collaborative-editor-client";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { useCollabToken } from "@/hooks/use-collab-token";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import {
  generateUserColor,
  type ConnectionStatus as EditorConnectionStatus,
} from "@repo/editor";
import {
  useCollaboration,
  type ConnectionStatus,
} from "./collaboration-context";

interface EditorContentProps {
  locale: string;
  documentId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export function EditorContent({
  locale,
  documentId,
  userId,
  userName,
  userEmail,
}: EditorContentProps) {
  const { data: document, isLoading, error } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();
  const { setConnectedUsers, setConnectionStatus } = useCollaboration();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contentDebounced = useDebounce(content, 1000);
  const titleDebounced = useDebounce(title, 500);
  const iconDebounced = useDebounce(icon, 500);

  // 只读模式：已删除的文档或只有查看权限
  const isReadOnly =
    !!document?.deletedAt || (document as any)?.accessLevel === "view";

  // 判断是否是文档所有者
  const isOwner = (document as any)?.accessLevel === "owner";

  // 判断是否启用协同编辑：
  // 1. 文档在工作空间中 + 当前用户有编辑权限
  // 2. 文档有访客协作者 + 当前用户是协作者且有编辑权限
  const enableCollaboration = useMemo(() => {
    if (!document || isReadOnly) return false;

    // 防止使用旧文档数据（React Query 缓存可能会在 ID 变化后短暂返回旧数据）
    if (document.id !== documentId) return false;

    const accessLevel = (document as any)?.accessLevel;
    const hasEditAccess = accessLevel === "owner" || accessLevel === "edit";
    // 检查是否公开分享
    const isPublished = (document as any)?.isPublished;

    // 条件1：文档公开分享 + 有编辑权限
    if (isPublished && hasEditAccess) {
      return true;
    }

    // 条件2：当前用户是访客协作者 + 有编辑权限
    if ((document as any)?.isCurrentUserCollaborator && hasEditAccess) {
      return true;
    }

    // 条件3：文档有已接受的协作者 + 当前用户是文档所有者/有编辑权限
    if ((document as any)?.hasCollaborators && hasEditAccess) {
      return true;
    }

    return false;
  }, [document, isReadOnly]);

  // 协同编辑 token（仅在启用协同时获取）
  const { data: collabData, isLoading: isTokenLoading } = useCollabToken(
    enableCollaboration ? documentId : null
  );

  // 协同服务器 URL
  const collabServerUrl =
    process.env.NEXT_PUBLIC_COLLAB_SERVER_URL || "ws://localhost:1234";

  // 处理连接状态变更（将 editor 的状态类型转换为 context 的类型）
  const handleConnectionStatusChange = useCallback(
    (status: EditorConnectionStatus) => {
      setConnectionStatus(status as ConnectionStatus);
    },
    [setConnectionStatus]
  );

  // 用户信息
  const user = useMemo(
    () => ({
      name: userName || userEmail?.split("@")[0] || "Anonymous",
      color: generateUserColor(userId || "default"),
    }),
    [userId, userName, userEmail]
  );

  // 从 query 数据同步到本地 state（用于防抖编辑）
  // 使用 documentId 作为依赖，只在文档切换时同步，避免更新时的循环
  const prevDocumentIdRef = useRef<string | null>(null);
  const prevTitleRef = useRef<string>("");
  const prevIconRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>("");

  useEffect(() => {
    // 当文档加载完成且 documentId 发生变化时，更新本地 state
    if (document) {
      const isDocumentChanged = documentId !== prevDocumentIdRef.current;

      if (isDocumentChanged) {
        prevDocumentIdRef.current = documentId;
        const newTitle = document.title ?? "";
        const newIcon = document.icon ?? null;
        const newContent = document.content ?? "";

        setTitle(newTitle);
        setIcon(newIcon);
        setContent(newContent);

        // 重置 refs，避免下次比较时误判
        prevTitleRef.current = newTitle;
        prevIconRef.current = newIcon;
        prevContentRef.current = newContent;

        // 发送文档加载事件，通知其他组件
        window.dispatchEvent(
          new CustomEvent("document-loaded", { detail: document })
        );
      }
    }
  }, [document, documentId]);

  // 显示错误
  useEffect(() => {
    if (error) {
      toast.error(error.message || "加载文档失败");
    }
  }, [error]);

  // 防抖保存标题
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly || // 只读模式不保存
      titleDebounced === document.title ||
      titleDebounced === "" ||
      titleDebounced === prevTitleRef.current
    )
      return;

    prevTitleRef.current = titleDebounced;
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { title: titleDebounced },
      },
      {
        onSuccess: () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
        },
        onError: (error) => {
          toast.error(error.message || "更新标题失败");
        },
      }
    );
  }, [
    titleDebounced,
    documentId,
    document?.title,
    updateDocumentMutation.mutate,
  ]);

  // 防抖保存icon
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly || // 只读模式不保存
      iconDebounced === document.icon ||
      iconDebounced === prevIconRef.current
    )
      return;

    prevIconRef.current = iconDebounced;
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { icon: iconDebounced },
      },
      {
        onSuccess: () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
        },
        onError: (error) => {
          toast.error(error.message || "更新图标失败");
        },
      }
    );
  }, [
    iconDebounced,
    documentId,
    document?.icon,
    updateDocumentMutation.mutate,
  ]);

  // 防抖保存内容
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly || // 只读模式不保存
      contentDebounced === document.content ||
      contentDebounced === prevContentRef.current
    )
      return;

    prevContentRef.current = contentDebounced;
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { content: contentDebounced },
      },
      {
        onSuccess: () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
        },
        onError: (error) => {
          toast.error(error.message || "保存内容失败");
        },
      }
    );
  }, [
    contentDebounced,
    documentId,
    document?.content,
    document?.deletedAt,
    updateDocumentMutation.mutate,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
          onSuccess: () => {
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
          },
          onError: (error) => {
            toast.error(error.message || "更新封面失败");
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
          onSuccess: () => {
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
          },
          onError: (error) => {
            toast.error(error.message || "更新封面位置失败");
          },
        }
      );
    },
    [documentId, updateDocumentMutation.mutate]
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  if (isLoading || (enableCollaboration && isTokenLoading)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
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
        {enableCollaboration && collabData?.token && userId ? (
          // 协同编辑模式
          <CollaborativeEditorClient
            key={`${documentId}-collab`}
            documentId={documentId}
            token={collabData.token}
            user={user}
            serverUrl={collabServerUrl}
            readonly={isReadOnly}
            onConnectedUsersChange={setConnectedUsers}
            onConnectionStatusChange={handleConnectionStatusChange}
          />
        ) : (
          // 传统编辑模式
          document && (
            <EditorClient
              key={`${documentId}-${content ? "loaded" : "empty"}`}
              initialContent={content}
              onChange={handleContentChange}
              readonly={isReadOnly}
            />
          )
        )}
      </div>
    </div>
  );
}
