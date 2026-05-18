"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { EditorPageHeader } from "./editor-page-header";
import { UnifiedEditorClient } from "./unified-editor-client";
import { PdfConvertingOverlay } from "./pdf-converting-overlay";
import { EditorLoadingSkeleton, EditorBodyLoadingSkeleton } from "./editor-loading-skeleton";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCollabToken } from "@/hooks/use-collab-token";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import {
  generateUserColor,
  markdownToTiptap,
  type ConnectionStatus as EditorConnectionStatus,
} from "@repo/editor";
import {
  useCollaboration,
  type ConnectionStatus,
} from "./collaboration-context";
import {
  subscribeConvertTask,
  getConvertTask,
  isConvertTaskPipelineBusy,
} from "@/lib/pdf/convert-store";
import { EDITOR_PAGE_REQUEST_SAVE } from "@/lib/use-editor-page-shortcuts";

interface EditorContentProps {
  locale: string;
  documentId: string;
  /** PDF 转换流水线进行中：正文与页头编辑禁用 */
  conversionLocked?: boolean;
  userId?: string;
  userName?: string;
  userEmail?: string;
  /** Session.user.avatarUrl，写入协同 awareness 与评论作者头像 */
  userAvatarUrl?: string;
  /** 全宽模式 */
  isFullWidth?: boolean;
}

/**
 * 编辑器内容组件
 *
 * 新设计原则：
 * - 始终使用 UnifiedEditor（Yjs 本地 CRDT）
 * - 开启协同 = 连接 WebSocket（通过 collabConfig prop）
 * - 关闭协同 = 断开连接（collabConfig = null）
 * - 不再切换编辑器组件，避免页面刷新和数据不准确
 */
export function EditorContent({
  locale,
  documentId,
  conversionLocked = false,
  userId,
  userName,
  userEmail,
  userAvatarUrl,
  isFullWidth = false,
}: EditorContentProps) {
  const { data: document, isLoading, error } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();
  const { setConnectedUsers, setConnectionStatus } = useCollaboration();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [permissionRevoked, setPermissionRevoked] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contentDebounced = useDebounce(content, 1000);
  const titleDebounced = useDebounce(title, 500);
  const iconDebounced = useDebounce(icon, 500);

  // 只读模式：已删除的文档或只有查看权限
  const isReadOnly =
    !!document?.deletedAt || (document as any)?.accessLevel === "view";
  const effectiveReadOnly = isReadOnly || permissionRevoked;

  // 判断是否是文档所有者
  const isOwner = (document as any)?.accessLevel === "owner";

  // 判断是否需要连接协同 WebSocket
  // 新逻辑：根据文档状态判断是否需要连接，而不是切换编辑器
  const shouldConnectCollab = useMemo(() => {
    if (!document) return false;
    if (permissionRevoked) return false;
    if (document.id !== documentId) return false;

    const accessLevel = (document as any)?.accessLevel;
    if (!accessLevel) return false;

    const isPubliclyEditable =
      (document as any)?.isPubliclyEditable ?? false;
    const hasCollaborators = (document as any)?.hasCollaborators;
    const hasWorkspaceCollaborators = (document as any)
      ?.hasWorkspaceCollaborators;
    const isCurrentUserCollaborator = (document as any)
      ?.isCurrentUserCollaborator;
    const isDocumentOwner = (document as any)?.userId === userId;

    // Space documents are collaborative by default once the space has more
    // than one user who can access documents in that space.
    if (hasWorkspaceCollaborators) {
      return true;
    }

    // 场景1：他人文档（非拥有者）- 需要连接以看到他人操作
    if (!isDocumentOwner) {
      return true;
    }

    // 场景2：我的文档，但已开启公开协作或有协作者
    if (isPubliclyEditable || hasCollaborators) {
      return true;
    }

    // 场景3：我是协作者
    if (isCurrentUserCollaborator) {
      return true;
    }

    return false;
  }, [document, documentId, permissionRevoked, userId]);

  // 协同编辑 token（仅在需要连接协同时获取）
  const { data: collabData, isLoading: isTokenLoading } = useCollabToken(
    shouldConnectCollab ? documentId : null
  );

  // 协同服务器 URL
  const collabServerUrl =
    process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "ws://localhost:1234";

  // 协同配置（null = 本地模式，不连接 WebSocket）
  const collabConfig = useMemo(() => {
    if (!shouldConnectCollab || !collabData?.token) {
      return null;
    }
    return {
      serverUrl: collabServerUrl,
      token: collabData.token,
    };
  }, [shouldConnectCollab, collabData?.token, collabServerUrl]);

  /** 文档或协同模式切换时需重新等待编辑器就绪 */
  const editorMountKey = useMemo(
    () =>
      `${documentId}:${collabConfig?.token ?? "local"}:${
        permissionRevoked ? "revoked" : "active"
      }`,
    [documentId, collabConfig?.token, permissionRevoked]
  );

  /** 供异步回调读取：关闭协同后仍可能收到「已断开」，此时不应再更新顶栏状态 */
  const shouldConnectCollabRef = useRef(shouldConnectCollab);
  shouldConnectCollabRef.current = shouldConnectCollab;

  useEffect(() => {
    if (!shouldConnectCollab) {
      setConnectionStatus("idle");
      setConnectedUsers([]);
    }
  }, [shouldConnectCollab, setConnectionStatus, setConnectedUsers]);

  // 处理连接状态变更
  const handleConnectionStatusChange = useCallback(
    (status: EditorConnectionStatus) => {
      if (!shouldConnectCollabRef.current) {
        return;
      }
      setConnectionStatus(status as ConnectionStatus);
    },
    [setConnectionStatus]
  );

  // 处理权限变更：重新拉取文档数据（获取最新 accessLevel），并提示用户
  const handlePermissionRevoked = useCallback(() => {
    setPermissionRevoked(true);
    toast.error("权限已变更", {
      description: "你的编辑权限已被移除，已切换为只读模式",
    });
    // 重新拉取文档数据，让 isReadOnly 和 shouldConnectCollab 根据最新 accessLevel 自动更新
    queryClient.invalidateQueries({ queryKey: ["document", documentId] });
    // 强制断开协同连接状态
    setConnectionStatus("disconnected");
    setConnectedUsers([]);
  }, [queryClient, documentId, setConnectionStatus, setConnectedUsers]);

  // 用户信息
  const user = useMemo(() => {
    if (!userId) return undefined;
    return {
      name: userName || userEmail?.split("@")[0] || "Anonymous",
      color: generateUserColor(userId),
      ...(userAvatarUrl ? { avatar: userAvatarUrl } : {}),
    };
  }, [userId, userName, userEmail, userAvatarUrl]);

  // 从 query 数据同步到本地 state
  const prevDocumentIdRef = useRef<string | null>(null);
  const prevTitleRef = useRef<string>("");
  const prevIconRef = useRef<string | null>(null);
  const prevContentRef = useRef<string>("");

  // 初始化完成标志
  const isInitializedRef = useRef(false);

  const [isEditorBodyReady, setIsEditorBodyReady] = useState(false);
  /** 已把当前 documentId 对应的服务端正文快照写入 content state，再挂载编辑器，避免首帧 initialContent 为空 */
  const [documentSnapshotApplied, setDocumentSnapshotApplied] =
    useState(false);

  const handleEditorReady = useCallback(() => {
    setIsEditorBodyReady(true);
  }, []);

  useEffect(() => {
    setIsEditorBodyReady(false);
  }, [editorMountKey]);

  useEffect(() => {
    if (!document || document.id !== documentId) {
      setDocumentSnapshotApplied(false);
      return;
    }

    const isDocumentChanged = documentId !== prevDocumentIdRef.current;

    if (isDocumentChanged) {
      isInitializedRef.current = false;

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

      setDocumentSnapshotApplied(true);

      window.dispatchEvent(
        new CustomEvent("document-loaded", { detail: document })
      );

      setTimeout(() => {
        isInitializedRef.current = true;
      }, 600);
    }
  }, [document, documentId]);

  useEffect(() => {
    if (!permissionRevoked || !document || document.id !== documentId) {
      return;
    }

    const latestTitle = document.title ?? "";
    const latestIcon = document.icon ?? null;
    const latestContent = document.content ?? "";

    setTitle(latestTitle);
    setIcon(latestIcon);
    setContent(latestContent);

    prevTitleRef.current = latestTitle;
    prevIconRef.current = latestIcon;
    prevContentRef.current = latestContent;
    setDocumentSnapshotApplied(true);
  }, [document, documentId, permissionRevoked]);

  useEffect(() => {
    setPermissionRevoked(false);
  }, [documentId]);

  // 显示错误（仅在 EditorContent 内部渲染时的非致命错误）
  // 注意：致命错误（401/403/404）已在 EditorPageClient 中处理并显示错误页面
  useEffect(() => {
    if (error) {
      const docError = error as any;
      const statusCode = docError?.statusCode ?? 0;
      // 非权限/不存在类错误才显示 toast
      if (statusCode !== 401 && statusCode !== 403 && statusCode !== 404) {
        toast.error(error.message || "加载文档失败");
      }
    }
  }, [error]);

  // 订阅 PDF 转换完成事件
  useEffect(() => {
    const existing = getConvertTask(documentId);
    if (existing?.status === "done" && existing.markdown) {
      const tiptapJson = markdownToTiptap(existing.markdown);
      const jsonStr = JSON.stringify(tiptapJson);
      setContent(jsonStr);
      prevContentRef.current = jsonStr;
      isInitializedRef.current = true;
    }

    return subscribeConvertTask(documentId, (task) => {
      if (task?.status === "done" && task.markdown) {
        const tiptapJson = markdownToTiptap(task.markdown);
        const jsonStr = JSON.stringify(tiptapJson);
        setContent(jsonStr);
        prevContentRef.current = jsonStr;
        isInitializedRef.current = true;
      }
    });
  }, [documentId]);

  // 防抖保存标题
  useEffect(() => {
    if (
      !isInitializedRef.current ||
      !documentId ||
      !document ||
      effectiveReadOnly ||
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
    effectiveReadOnly,
    updateDocumentMutation.mutate,
  ]);

  // 防抖保存 icon
  useEffect(() => {
    if (
      !isInitializedRef.current ||
      !documentId ||
      !document ||
      effectiveReadOnly ||
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
    effectiveReadOnly,
    updateDocumentMutation.mutate,
  ]);

  // 防抖保存内容（仅本地模式，协同模式通过 WebSocket 自动同步）
  useEffect(() => {
    if (
      shouldConnectCollab || // 协同模式下不通过 HTTP 保存
      !isInitializedRef.current ||
      !documentId ||
      !document ||
      effectiveReadOnly ||
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
    effectiveReadOnly,
    updateDocumentMutation.mutate,
    shouldConnectCollab,
  ]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const flushDocumentSave = useCallback(() => {
    if (!documentId || !document || !isInitializedRef.current) {
      return;
    }
    if (effectiveReadOnly || conversionLocked) {
      return;
    }

    const updates: {
      title?: string;
      icon?: string | null;
      content?: string;
    } = {};

    if (title.trim() !== "" && title !== document.title) {
      updates.title = title;
    }
    if (icon !== document.icon) {
      updates.icon = icon;
    }
    if (!shouldConnectCollab && content !== document.content) {
      updates.content = content;
    }

    if (Object.keys(updates).length === 0) {
      if (shouldConnectCollab) {
        toast.success("正文已通过协同实时同步");
      } else {
        toast.info("没有需要保存的更改");
      }
      return;
    }

    if (updates.title !== undefined) {
      prevTitleRef.current = updates.title;
    }
    if ("icon" in updates) {
      prevIconRef.current = updates.icon ?? null;
    }
    if (updates.content !== undefined) {
      prevContentRef.current = updates.content;
    }

    updateDocumentMutation.mutate(
      { documentId, updates },
      {
        onSuccess: () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
        },
        onError: (saveError) => {
          toast.error(saveError.message || "保存失败");
        },
      }
    );
  }, [
    content,
    conversionLocked,
    document,
    documentId,
    effectiveReadOnly,
    icon,
    shouldConnectCollab,
    title,
    updateDocumentMutation.mutate,
  ]);

  useEffect(() => {
    const onRequestSave = () => {
      flushDocumentSave();
    };
    window.addEventListener(EDITOR_PAGE_REQUEST_SAVE, onRequestSave);
    return () => {
      window.removeEventListener(EDITOR_PAGE_REQUEST_SAVE, onRequestSave);
    };
  }, [flushDocumentSave]);

  // PDF 转换锁定处理
  useEffect(() => {
    if (!conversionLocked) {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onPageHide = (e: PageTransitionEvent) => {
      if (e.persisted) {
        return;
      }
      const task = getConvertTask(documentId);
      if (!isConvertTaskPipelineBusy(task)) {
        return;
      }
      fetch(`/api/editor-documents/${documentId}?permanent=true`, {
        method: "DELETE",
        credentials: "include",
        keepalive: true,
      });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [documentId, conversionLocked]);

  const handleTitleChange = useCallback((newTitle: string) => {
    if (effectiveReadOnly || conversionLocked) {
      return;
    }
    setTitle(newTitle);
  }, [conversionLocked, effectiveReadOnly]);

  const handleIconChange = useCallback((newIcon: string | null) => {
    if (effectiveReadOnly || conversionLocked) {
      return;
    }
    setIcon(newIcon);
  }, [conversionLocked, effectiveReadOnly]);

  const handleCoverChange = useCallback(
    async (cover: string | null, coverImageType?: "color" | "url") => {
      if (!documentId) return;
      if (effectiveReadOnly || conversionLocked) return;

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
    [
      conversionLocked,
      documentId,
      effectiveReadOnly,
      updateDocumentMutation.mutate,
    ]
  );

  const handleCoverPositionChange = useCallback(
    async (position: number) => {
      if (!documentId) return;
      if (effectiveReadOnly || conversionLocked) return;

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
    [
      conversionLocked,
      documentId,
      effectiveReadOnly,
      updateDocumentMutation.mutate,
    ]
  );

  // 编辑器内容变更回调（本地模式需要保存）
  const handleEditorUpdate = useCallback(
    (editor: any) => {
      if (effectiveReadOnly || conversionLocked) {
        return;
      }
      const jsonContent = JSON.stringify(editor.getJSON());
      setContent(jsonContent);
    },
    [conversionLocked, effectiveReadOnly]
  );

  // 等待文档加载完成，如果需要协同则等待 token
  if (isLoading || (shouldConnectCollab && isTokenLoading)) {
    return <EditorLoadingSkeleton className="min-h-full pt-11" />;
  }

  return (
    <div className="relative min-h-full pt-11">
      <PdfConvertingOverlay documentId={documentId} />
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
        readonly={effectiveReadOnly || conversionLocked}
        isOwner={isOwner}
        isLoggedIn={!!userId}
        isFullWidth={isFullWidth}
      />

      <div
        className={
          isFullWidth
            ? "relative mx-auto min-h-[min(50vh,520px)] px-8"
            : "relative mx-auto min-h-[min(50vh,520px)] max-w-4xl px-4"
        }
      >
        {document && !documentSnapshotApplied ? (
          <EditorBodyLoadingSkeleton />
        ) : null}
        {document && documentSnapshotApplied ? (
          <>
            {!isEditorBodyReady ? (
              <div className="absolute inset-0 z-10 bg-background pt-1">
                <EditorBodyLoadingSkeleton />
              </div>
            ) : null}
            <div
              className={
                isEditorBodyReady ? undefined : "pointer-events-none opacity-0"
              }
              aria-hidden={!isEditorBodyReady}
            >
              <UnifiedEditorClient
                key={editorMountKey}
                documentId={documentId}
                initialContent={content}
                user={user}
                collabConfig={collabConfig}
                readonly={effectiveReadOnly || conversionLocked}
                onConnectedUsersChange={setConnectedUsers}
                onConnectionStatusChange={handleConnectionStatusChange}
                onPermissionRevoked={handlePermissionRevoked}
                onUpdate={shouldConnectCollab ? undefined : handleEditorUpdate}
                onEditorReady={handleEditorReady}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
