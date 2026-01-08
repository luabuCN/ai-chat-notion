"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { EditorPageHeader } from "./editor-page-header";
import { EditorClient } from "./editor-client";
import { CollaborativeEditorClient } from "./collaborative-editor-client";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { useCollabToken } from "@/hooks/use-collab-token";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { generateUserColor } from "@repo/editor";
import { useCollaboration } from "./collaboration-context";

interface SmartEditorContentProps {
  locale: string;
  documentId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  /**
   * 是否强制启用协同编辑模式
   * - true: 强制启用
   * - false: 强制禁用
   * - undefined: 自动检测（根据工作空间成员和访客协作者判断）
   */
  enableCollaboration?: boolean;
}

/**
 * 智能编辑器内容组件
 * 根据配置自动选择使用协同编辑器或传统编辑器
 *
 * 自动启用协同的条件：
 * 1. 文档在工作空间中 + 当前用户有编辑权限
 * 2. 文档有访客协作者 + 当前用户是协作者且有编辑权限
 */
export function SmartEditorContent({
  locale,
  documentId,
  userId,
  userName,
  userEmail,
  enableCollaboration,
}: SmartEditorContentProps) {
  const { data: document, isLoading, error } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();

  // 只读模式：已删除的文档或只有查看权限
  const isReadOnly =
    !!document?.deletedAt || (document as any)?.accessLevel === "view";

  // 使用 ref 锁定协同模式决策，防止后续重渲染导致模式切换
  const collabModeDecidedRef = useRef<boolean | null>(null);

  // 自动检测是否应该启用协同编辑
  const shouldEnableCollaboration = useMemo(() => {
    // 如果明确指定了，使用指定的值
    if (enableCollaboration !== undefined) {
      return enableCollaboration;
    }

    // 如果已经做出决策且 document 数据可用，保持原决策
    if (collabModeDecidedRef.current !== null && document) {
      return collabModeDecidedRef.current;
    }

    // 自动检测逻辑
    if (!document || isReadOnly) return false;

    const accessLevel = (document as any)?.accessLevel;
    const hasEditAccess = accessLevel === "owner" || accessLevel === "edit";
    const docHasCollaborators = (document as any)?.hasCollaborators;
    const isUserCollaborator = (document as any)?.isCurrentUserCollaborator;

    console.log("[Collab Detection]", {
      workspaceId: document.workspaceId,
      accessLevel,
      hasEditAccess,
      hasCollaborators: docHasCollaborators,
      isCurrentUserCollaborator: isUserCollaborator,
    });

    // 条件1：工作空间文档 + 有编辑权限
    if (document.workspaceId && hasEditAccess) {
      collabModeDecidedRef.current = true;
      return true;
    }

    // 条件2：当前用户是访客协作者 + 有编辑权限
    if (isUserCollaborator && hasEditAccess) {
      collabModeDecidedRef.current = true;
      return true;
    }

    // 条件3：文档有访客协作者 + 当前用户是文档所有者 + 有编辑权限
    if (docHasCollaborators && hasEditAccess) {
      collabModeDecidedRef.current = true;
      return true;
    }

    collabModeDecidedRef.current = false;
    return false;
  }, [document, isReadOnly, enableCollaboration]);

  // 协同编辑 token（仅在启用协同编辑时获取）
  const {
    data: collabData,
    isLoading: isTokenLoading,
    error: tokenError,
  } = useCollabToken(shouldEnableCollaboration ? documentId : null);

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const { setConnectedUsers } = useCollaboration();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contentDebounced = useDebounce(content, 1000);
  const titleDebounced = useDebounce(title, 500);
  const iconDebounced = useDebounce(icon, 500);

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

  // 从 query 数据同步到本地 state
  const prevDocumentIdRef = useRef<string | null>(null);
  const prevTitleRef = useRef<string>("");
  const prevIconRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>("");

  useEffect(() => {
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

        prevTitleRef.current = newTitle;
        prevIconRef.current = newIcon;
        prevContentRef.current = newContent;

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
    if (tokenError) {
      toast.error(tokenError.message || "获取协同编辑权限失败");
    }
  }, [error, tokenError]);

  // 防抖保存标题
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly ||
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
        onError: (err) => {
          toast.error(err.message || "更新标题失败");
        },
      }
    );
  }, [
    titleDebounced,
    documentId,
    document?.title,
    updateDocumentMutation.mutate,
    isReadOnly,
  ]);

  // 防抖保存图标
  useEffect(() => {
    if (
      !documentId ||
      !document ||
      isReadOnly ||
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
        onError: (err) => {
          toast.error(err.message || "更新图标失败");
        },
      }
    );
  }, [
    iconDebounced,
    documentId,
    document?.icon,
    updateDocumentMutation.mutate,
    isReadOnly,
  ]);

  // 防抖保存内容（仅非协同模式）
  useEffect(() => {
    if (
      shouldEnableCollaboration || // 协同模式下不通过 HTTP 保存内容
      !documentId ||
      !document ||
      isReadOnly ||
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
        onError: (err) => {
          toast.error(err.message || "保存内容失败");
        },
      }
    );
  }, [
    contentDebounced,
    documentId,
    document?.content,
    document?.deletedAt,
    updateDocumentMutation.mutate,
    shouldEnableCollaboration,
    isReadOnly,
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
          onSuccess: () => {
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
          },
          onError: (err) => {
            toast.error(err.message || "更新封面位置失败");
          },
        }
      );
    },
    [documentId, updateDocumentMutation.mutate]
  );

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  if (isLoading || (shouldEnableCollaboration && isTokenLoading)) {
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
      />

      <div className="max-w-4xl mx-auto px-4 pb-20">
        {shouldEnableCollaboration && collabData?.token ? (
          // 协同编辑模式
          <CollaborativeEditorClient
            key={`${documentId}-collab`}
            documentId={documentId}
            token={collabData.token}
            user={user}
            serverUrl={collabServerUrl}
            readonly={isReadOnly}
            onConnectedUsersChange={setConnectedUsers}
          />
        ) : (
          // 传统编辑模式
          document && (
            <EditorClient
              key={`${documentId}-editor`}
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
