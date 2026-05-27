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

/**
 * 浏览器侧 Uint8Array → base64：逐字节拼接再 `btoa`。
 * 禁止使用 `String.fromCharCode.apply(null, hugeArray)`——参数过多会触发 RangeError / 栈溢出。
 */
function encodeYjsStateToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j += 1) {
      binary += String.fromCharCode(bytes[j]);
    }
  }
  return globalThis.btoa(binary);
}

interface EditorContentProps {
  locale: string;
  documentId: string;
  /**
   * 强制「仅 HTTP 落库、不连协同 WS」（降级路径）。
   * 预览只读页使用 `PreviewEditorClient`，不经此处；一般为 false。
   */
  forcePlainLocalPersistence?: boolean;
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
  forcePlainLocalPersistence = false,
  conversionLocked = false,
  userId,
  userName,
  userEmail,
  userAvatarUrl,
  isFullWidth = false,
}: EditorContentProps) {
  const { data: document, isLoading, error } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();
  const { connectedUsers, setConnectedUsers, setConnectionStatus } = useCollaboration();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [content, setContent] = useState("");
  /**
   * 本地模式下从 UnifiedEditor 收到的 Yjs 二进制快照（base64）。
   * 包含正文与评论 CRDT；与 content 并行落库，防止评论丢失。
   */
  const [localYjsStateB64, setLocalYjsStateB64] = useState<string | null>(null);
  /** 与 handleLocalYjsState 同步，供 Cmd+S 立即刷新时可读到最新快照 */
  const latestYjsStateB64Ref = useRef<string | null>(null);
  /** 本地 PATCH yjsState 去重：避免与服务端往返后与防抖快照误判重复写入 */
  const prevLocalYjsStateB64Ref = useRef<string | null>(null);
  const [permissionRevoked, setPermissionRevoked] = useState(false);
  /** 协同 WS 不可用时走 HTTP 落库（content + yjsState） */
  const [collabPersistenceFallback, setCollabPersistenceFallback] =
    useState(false);
  const collabFallbackToastShownRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contentDebounced = useDebounce(content, 1000);
  const titleDebounced = useDebounce(title, 500);
  const iconDebounced = useDebounce(icon, 500);
  const localYjsStateB64Debounced = useDebounce(localYjsStateB64, 1000);

  // 只读模式：已删除的文档或只有查看权限
  const isReadOnly =
    !!document?.deletedAt || (document as any)?.accessLevel === "view";
  const effectiveReadOnly = isReadOnly || permissionRevoked;

  // 判断是否是文档所有者
  const isOwner = (document as any)?.accessLevel === "owner";

  /**
   * 工作台编辑页：默认可编辑文档一律走协同 WS（持久化由 collab-server 写 yjsState）。
   * 预览只读分享仍走 `PreviewEditorClient` + `content` JSON，不经此组件。
   * `forcePlainLocalPersistence` 为极少数需强制 HTTP-only 的场景保留降级开关。
   */
  const shouldConnectCollab = useMemo(() => {
    if (forcePlainLocalPersistence) return false;
    if (!document) return false;
    if (permissionRevoked) return false;
    if (document.id !== documentId) return false;

    const accessLevel = (document as any)?.accessLevel;
    if (!accessLevel) return false;

    // 只读权限：不建立协同连接（也无编辑保存）
    if (accessLevel === "view") return false;

    return true;
  }, [document, documentId, forcePlainLocalPersistence, permissionRevoked]);

  // 协同编辑 token（仅在需要连接协同时获取）
  const {
    data: collabData,
    isLoading: isTokenLoading,
    isError: isCollabTokenError,
  } = useCollabToken(shouldConnectCollab ? documentId : null);

  const useHttpPersistence =
    !shouldConnectCollab || collabPersistenceFallback || isCollabTokenError;

  // 协同服务器 URL
  const collabServerUrl =
    process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || "ws://localhost:4000/collab";

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

  /** 文档或协同模式切换时需重新等待编辑器就绪（勿把 token 放进 key，避免 token 就绪后整页重挂载） */
  const editorMountKey = useMemo(
    () =>
      `${documentId}:${shouldConnectCollab ? "collab" : "plain"}:${
        permissionRevoked ? "revoked" : "active"
      }`,
    [documentId, permissionRevoked, shouldConnectCollab]
  );

  /** 供异步回调读取：关闭协同后仍可能收到「已断开」，此时不应再更新顶栏状态 */
  const shouldConnectCollabRef = useRef(shouldConnectCollab);
  shouldConnectCollabRef.current = shouldConnectCollab;

  /** 供 fallback 回调读取断开瞬间的协同用户数（≥2 才提示，避免单人编辑时误报） */
  const connectedUsersCountRef = useRef(connectedUsers.length);
  connectedUsersCountRef.current = connectedUsers.length;

  useEffect(() => {
    if (!shouldConnectCollab) {
      setConnectionStatus("idle");
      setConnectedUsers([]);
    }
  }, [shouldConnectCollab, setConnectionStatus, setConnectedUsers]);

  const activateCollabHttpFallback = useCallback(() => {
    if (!shouldConnectCollabRef.current) {
      return;
    }
    setCollabPersistenceFallback(true);
    setIsEditorBodyReady(true);
    if (
      !collabFallbackToastShownRef.current &&
      connectedUsersCountRef.current >= 2
    ) {
      collabFallbackToastShownRef.current = true;
      toast.warning("协同已断开");
    }
  }, []);

  // 处理连接状态变更
  const handleConnectionStatusChange = useCallback(
    (status: EditorConnectionStatus) => {
      if (!shouldConnectCollabRef.current) {
        return;
      }
      setConnectionStatus(status as ConnectionStatus);
      if (status === "disconnected") {
        activateCollabHttpFallback();
      }
      if (status === "connected") {
        setCollabPersistenceFallback(false);
      }
    },
    [activateCollabHttpFallback, setConnectionStatus]
  );

  const handleCollabDisconnect = useCallback(() => {
    activateCollabHttpFallback();
  }, [activateCollabHttpFallback]);

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
  /** 供 yjs 回调读取：避免闭包读到旧的「编辑器是否已挂载就绪」 */
  const isEditorBodyReadyRef = useRef(false);
  useEffect(() => {
    isEditorBodyReadyRef.current = isEditorBodyReady;
  }, [isEditorBodyReady]);
  /** 已把当前 documentId 对应的服务端正文快照写入 content state，再挂载编辑器，避免首帧 initialContent 为空 */
  const [documentSnapshotApplied, setDocumentSnapshotApplied] =
    useState(false);

  const handleEditorReady = useCallback(() => {
    setIsEditorBodyReady(true);
  }, []);

  useEffect(() => {
    setIsEditorBodyReady(false);
  }, [editorMountKey]);

  /** 协同 onSynced 丢失等极端情况下的兜底，避免骨架层永久盖住正文 */
  useEffect(() => {
    if (!documentSnapshotApplied || isEditorBodyReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsEditorBodyReady(true);
    }, 3_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [documentSnapshotApplied, editorMountKey, isEditorBodyReady]);

  useEffect(() => {
    if (!document || document.id !== documentId) {
      setDocumentSnapshotApplied(false);
      return;
    }

    const isDocumentChanged = documentId !== prevDocumentIdRef.current;
    if (isDocumentChanged) {
      isInitializedRef.current = false;
      prevDocumentIdRef.current = documentId;
      window.dispatchEvent(
        new CustomEvent("document-loaded", { detail: document })
      );
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 600);
    }

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
    setCollabPersistenceFallback(false);
    collabFallbackToastShownRef.current = false;
  }, [documentId]);

  useEffect(() => {
    if (!isCollabTokenError || !shouldConnectCollab) {
      return;
    }
    setCollabPersistenceFallback(true);
    setIsEditorBodyReady(true);
    if (!collabFallbackToastShownRef.current) {
      collabFallbackToastShownRef.current = true;
      toast.warning("协同服务不可用", {
        description: "已切换为接口保存，编辑内容将写入数据库",
      });
    }
  }, [isCollabTokenError, shouldConnectCollab]);

  // 切换文档时清空 yjsState 缓冲 / 去重指针，防止跨文档写入旧 doc 的状态
  useEffect(() => {
    setLocalYjsStateB64(null);
    latestYjsStateB64Ref.current = null;
    prevLocalYjsStateB64Ref.current = null;
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

  // 防抖保存内容（本地模式或协同断开兜底）：正文 JSON + Yjs 快照合并为**单次 PATCH**
  useEffect(() => {
    if (
      !useHttpPersistence ||
      !isEditorBodyReady ||
      !documentId ||
      !document ||
      effectiveReadOnly
    ) {
      return;
    }

    const contentNeedsPatch =
      contentDebounced !== document.content &&
      contentDebounced !== prevContentRef.current;

    const yjsNeedsPatch =
      localYjsStateB64Debounced !== null &&
      localYjsStateB64Debounced !== prevLocalYjsStateB64Ref.current;

    if (!contentNeedsPatch && !yjsNeedsPatch) {
      return;
    }

    const updates: { content?: string; yjsState?: string } = {};

    if (contentNeedsPatch) {
      updates.content = contentDebounced;
      prevContentRef.current = contentDebounced;
    }
    if (yjsNeedsPatch) {
      updates.yjsState = localYjsStateB64Debounced;
      prevLocalYjsStateB64Ref.current = localYjsStateB64Debounced;
    }

    updateDocumentMutation.mutate(
      {
        documentId,
        updates,
      },
      {
        onSuccess: () => {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
        },
        onError: (error) => {
          toast.error(error.message || "保存失败");
        },
      }
    );
  }, [
    contentDebounced,
    localYjsStateB64Debounced,
    documentId,
    document?.content,
    document?.deletedAt,
    effectiveReadOnly,
    useHttpPersistence,
    updateDocumentMutation.mutate,
    isEditorBodyReady,
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
      yjsState?: string;
    } = {};

    if (title.trim() !== "" && title !== document.title) {
      updates.title = title;
    }
    if (icon !== document.icon) {
      updates.icon = icon;
    }
    if (useHttpPersistence) {
      if (content !== document.content) {
        updates.content = content;
      }
      const yjsLatest = latestYjsStateB64Ref.current;
      if (yjsLatest !== null) {
        updates.yjsState = yjsLatest;
      }
    }

    if (Object.keys(updates).length === 0) {
      if (shouldConnectCollab && !useHttpPersistence) {
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
    if (updates.yjsState !== undefined) {
      prevLocalYjsStateB64Ref.current = updates.yjsState;
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
    useHttpPersistence,
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

  // 本地模式：每次 ydoc 变更上抛的二进制快照，转 base64 后由防抖 effect 落库
  const handleLocalYjsState = useCallback(
    (state: Uint8Array) => {
      if (effectiveReadOnly || conversionLocked) {
        return;
      }
      // 与防抖落库 effect 对齐：须等编辑器就绪后再采集 yjs，否则会因依赖未触发而丢保存
      if (!isEditorBodyReadyRef.current) {
        return;
      }
      const b64 = encodeYjsStateToBase64(state);
      latestYjsStateB64Ref.current = b64;
      setLocalYjsStateB64(b64);
    },
    [conversionLocked, effectiveReadOnly]
  );

  // 等待文档加载；协同 token 仅首次请求时阻塞，失败则立即走 HTTP 兜底
  if (isLoading || (shouldConnectCollab && isTokenLoading && !isCollabTokenError)) {
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
                onDisconnect={handleCollabDisconnect}
                onUpdate={useHttpPersistence ? handleEditorUpdate : undefined}
                onLocalYjsState={
                  useHttpPersistence ? handleLocalYjsState : undefined
                }
                enableHttpPersistence={collabPersistenceFallback}
                onEditorReady={handleEditorReady}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
