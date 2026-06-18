import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImagePreviewControlled } from "@repo/ui";
import { toast } from "sonner";
import * as Y from "yjs";
import { defaultExtensions } from "./tiptap/default-extensions";
import { DocumentLink } from "./tiptap/extensions/document-link";
import { AttachmentUploadPlaceholder } from "./tiptap/extensions/attachment-upload-placeholder/attachment-upload-placeholder";
import { ImageUploadPlaceholder } from "./tiptap/extensions/image-upload-placeholder/image-upload-placeholder";
import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import {
  TIPTAP_IMAGE_PREVIEW_EVENT,
  type TiptapImagePreviewDetail,
} from "./tiptap/extensions/image/image";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import { CommentBlockMarginTrigger } from "./components/comment-prototype/comment-block-margin-trigger";
import type { CommentMentionNotifyParams } from "./components/comment-prototype/comment-prototype-form";
import { BlockDragHandleToolbar } from "./components/block-drag-handle-toolbar";
import { LinkConfirmDialog } from "./components/link-confirm-dialog";
import { handleLinkClick } from "./lib/link-click-handler";
import AIPanel from "./components/ai-panel";
import { TableOfContents } from "./components/table-of-contents";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";
import "./styles/tiptap-editor.css";
import { CodeBlockBubbleMenu } from "./tiptap/menus/codeblock-bubble-menu";
import { SearchReplacePanel } from "./components/search-replace-panel";

/** 监听图片预览自定义事件，用受控模式展示全屏预览（与 tiptap-editor 一致） */
function ImagePreviewPortal() {
  const [state, setState] = useState<{ src: string; visible: boolean } | null>(
    null
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TiptapImagePreviewDetail>).detail;
      setState({ src: detail.src, visible: true });
    };
    window.addEventListener(TIPTAP_IMAGE_PREVIEW_EVENT, handler);
    return () => window.removeEventListener(TIPTAP_IMAGE_PREVIEW_EVENT, handler);
  }, []);

  if (!state) return null;

  return (
    <ImagePreviewControlled
      src={state.src}
      visible={state.visible}
      onClose={() => setState(null)}
    />
  );
}

export interface CollaborativeUser {
  name: string;
  color: string;
  avatar?: string;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "idle";

function decodeBase64ToUint8Array(b64: string): Uint8Array {
  const binary = globalThis.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface UnifiedEditorProps {
  documentId: string;
  initialContent?: string;
  /** 非协同模式下从数据库 yjsState 恢复正文（base64，服务端已解压） */
  initialYjsStateB64?: string | null;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  /** 初始内容已应用且可展示时调用（含协同同步完成、setContent 与下一帧绘制） */
  onEditorReady?: () => void;
  onWebSocketSynced?: () => void;
  onDisconnect?: () => void;
  /** 权限变更导致连接被关闭 */
  onPermissionRevoked?: () => void;
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  className?: string;
  showAiTools?: boolean;
  aiApiUrl?: string;
  uploadFile?: (file: File) => Promise<string>;
  readonly?: boolean;
  navigate?: (href: string) => void;
  user?: CollaborativeUser;
  collabConfig?: {
    serverUrl: string;
    token: string;
  } | null;
  /**
   * 每次本地 ydoc 变更后回调，把 `Y.encodeStateAsUpdate(ydoc)` 上抛给宿主层。
   * 协同在线时由 collab-server 写库；`enableHttpPersistence` 为 true 时协同断开也会触发（HTTP 兜底）。
   */
  onLocalYjsState?: (state: Uint8Array) => void;
  /** 协同 WS 不可用时仍通过 HTTP 上报 yjs 快照（与 onLocalYjsState 配合） */
  enableHttpPersistence?: boolean;
  /** 可提及的用户列表（由外部提供，透传给评论组件） */
  mentionableUsers?: Array<{ id: string; name: string; email?: string; avatar?: string }>;
  /** 通知跳转：目标评论 ID */
  highlightCommentId?: string;
  /** 通知跳转：目标评论所在 block ID */
  highlightBlockId?: string;
  /** 评论含 @提及时通知服务端（由宿主层注入） */
  onCommentMentionNotify?: (
    params: CommentMentionNotifyParams
  ) => void | Promise<void>;
}

export type { CommentMentionNotifyParams };

/**
 * 统一编辑器组件
 *
 * 关键设计：
 * - Provider 在 documentId 变化时创建，使用 collabConfig 的 url/token
 * - 通过 provider.connect()/disconnect() 动态控制 WebSocket 连接
 * - Editor 的 key 使用 documentId + (collabConfig ? 'collab' : 'local')
 *   这样切换协同模式时会重新创建 editor（避免 awareness 错误）
 * - 但不会刷新整个页面，只是重新创建编辑器实例
 */
export function UnifiedEditor({
  documentId,
  initialContent,
  initialYjsStateB64,
  placeholder,
  onCreate,
  onUpdate,
  onEditorReady,
  onWebSocketSynced,
  onDisconnect,
  onPermissionRevoked,
  onConnectedUsersChange,
  onConnectionStatusChange,
  className = "",
  showAiTools = true,
  aiApiUrl,
  uploadFile,
  readonly = false,
  navigate,
  user,
  collabConfig,
  onLocalYjsState,
  enableHttpPersistence = false,
  mentionableUsers,
  highlightCommentId,
  highlightBlockId,
  onCommentMentionNotify,
}: UnifiedEditorProps) {
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const stableNavigate = useCallback((href: string) => {
    if (navigateRef.current) {
      navigateRef.current(href);
    } else {
      window.location.href = href;
    }
  }, []);

  const onWebSocketSyncedRef = useRef(onWebSocketSynced);
  onWebSocketSyncedRef.current = onWebSocketSynced;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;
  const onPermissionRevokedRef = useRef(onPermissionRevoked);
  onPermissionRevokedRef.current = onPermissionRevoked;
  const onConnectedUsersChangeRef = useRef(onConnectedUsersChange);
  onConnectedUsersChangeRef.current = onConnectedUsersChange;
  const onConnectionStatusChangeRef = useRef(onConnectionStatusChange);
  onConnectionStatusChangeRef.current = onConnectionStatusChange;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;
  const onLocalYjsStateRef = useRef(onLocalYjsState);
  onLocalYjsStateRef.current = onLocalYjsState;
  const userRef = useRef(user);
  userRef.current = user;

  /** 写入 Yjs awareness 的用户信息；CollaborationCaret 会覆盖 `user` 字段，必须含 avatar */
  const awarenessUser = useMemo(() => {
    if (!user) {
      return null;
    }
    return {
      name: user.name,
      color: user.color,
      ...(user.avatar ? { avatar: user.avatar } : {}),
    };
  }, [user]);

  const stableUploadFile = useCallback(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }, []);

  const isMountedRef = useRef(false);
  const connectedUsersSigRef = useRef("");
  /** 递增后使旧 provider 的 onSynced 等异步回调失效，避免 Strict Mode 下丢同步事件 */
  const providerGenerationRef = useRef(0);
  const [isCommentUiEnabled, setIsCommentUiEnabled] = useState(false);

  // 连接状态
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    collabConfig ? "connecting" : "idle"
  );

  // 编辑器版本 key：documentId + 协同模式
  // 切换协同模式时会重新创建编辑器
  const editorKey = useMemo(
    () => `${documentId}-${collabConfig ? "collab" : "local"}`,
    [documentId, collabConfig]
  );

  // 创建 Yjs 文档；非协同模式可从 initialYjsStateB64 预灌正文
  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    if (!collabConfig && initialYjsStateB64) {
      try {
        Y.applyUpdate(doc, decodeBase64ToUint8Array(initialYjsStateB64));
      } catch {
        // 解码失败时回退到 initialContent
      }
    }
    return doc;
  }, [collabConfig, documentId, initialYjsStateB64]);

  const [isWebSocketSynced, setIsWebSocketSynced] = useState(!collabConfig);

  // 延迟渲染状态
  const [isClientReady, setIsClientReady] = useState(false);

  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      providerGenerationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      setIsClientReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    connectedUsersSigRef.current = "";
    setIsWebSocketSynced(!collabConfig);
    setIsCommentUiEnabled(false);
  }, [editorKey, collabConfig]);

  /** Provider 必须在 effect 中创建：在 useMemo/render 里建连会触发「未挂载就 setState」警告 */
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);

  useEffect(() => {
    const generation = providerGenerationRef.current + 1;
    providerGenerationRef.current = generation;

    const serverUrl =
      collabConfig?.serverUrl ||
      process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ||
      "ws://localhost:4000/collab";

    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token: collabConfig?.token || "",
      onStatus: ({ status: s }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          const newStatus = s as ConnectionStatus;
          setConnectionStatus(newStatus);
          onConnectionStatusChangeRef.current?.(newStatus);
          if (s === "disconnected") {
            if (collabConfig) {
              setIsWebSocketSynced(true);
            }
            onDisconnectRef.current?.();
          }
        }, 0);
      },
      onSynced: ({ state }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          if (state) {
            setIsWebSocketSynced(true);
            onWebSocketSyncedRef.current?.();
          }
        }, 0);
      },
      onAwarenessUpdate: ({ states }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          const raw = Array.from(states.values())
            .filter(
              (state: Record<string, unknown>) =>
                state.user && (state.user as Record<string, unknown>).name
            )
            .map(
              (state: Record<string, unknown>) =>
                state.user as CollaborativeUser
            );

          const byKey = new Map<string, CollaborativeUser>();
          for (const u of raw) {
            const key = `${u.name}|${u.color}`;
            const prev = byKey.get(key);
            if (!prev) {
              byKey.set(key, u);
              continue;
            }
            if (!prev.avatar && typeof u.avatar === "string" && u.avatar) {
              byKey.set(key, u);
            }
          }
          const users = Array.from(byKey.values());

          const sig = users
            .map(
              (u) =>
                `${u.name}|${u.color}|${
                  typeof u.avatar === "string" ? u.avatar : ""
                }`
            )
            .sort()
            .join(",");

          if (sig !== connectedUsersSigRef.current) {
            connectedUsersSigRef.current = sig;
            onConnectedUsersChangeRef.current?.(users);
          }
        }, 0);
      },
      onAuthenticationFailed: ({ reason }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          toast.error("认证失败", {
            description: reason || "无法连接到协同服务器",
          });
        }, 0);
      },
      onClose: ({ event }) => {
        setTimeout(() => {
          if (providerGenerationRef.current !== generation) return;
          if (!isMountedRef.current) return;
          if (event?.code === 4003) {
            p.disconnect();
            onPermissionRevokedRef.current?.();
          }
        }, 0);
      },
    });

    if (userRef.current) {
      p.setAwarenessField("user", userRef.current);
    }

    if (!collabConfig) {
      p.disconnect();
    }

    setProvider(p);

    return () => {
      providerGenerationRef.current += 1;
      p.disconnect();
      p.destroy();
      setProvider(null);
    };
  }, [collabConfig, documentId, ydoc]);

  /** 刷新时 onSynced 可能早于订阅；挂载后补查 provider.synced + 超时兜底 */
  useEffect(() => {
    if (!collabConfig || !provider) {
      return;
    }

    const providerWithSync = provider as HocuspocusProvider & {
      synced?: boolean;
    };
    if (providerWithSync.synced && isMountedRef.current) {
      setIsWebSocketSynced(true);
    }

    const fallbackMs = 2_000;
    const fallbackTimer = window.setTimeout(() => {
      if (!isMountedRef.current) {
        return;
      }
      setIsWebSocketSynced((prev) => {
        if (prev) {
          return prev;
        }
        setConnectionStatus("disconnected");
        onConnectionStatusChangeRef.current?.("disconnected");
        onDisconnectRef.current?.();
        return true;
      });
    }, fallbackMs);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [collabConfig, editorKey, provider]);

  // 更新 awareness（CollaborationCaret 插件 init 也会写 user，需与之保持一致）
  useEffect(() => {
    if (provider && awarenessUser) {
      provider.setAwarenessField("user", awarenessUser);
    }
  }, [provider, awarenessUser]);

  // Extensions
  const extensions = useMemo(() => {
    const exts = [
      ...defaultExtensions,
      ImageUploadPlaceholder.configure({
        uploadFile: stableUploadFile,
      }),
      AttachmentUploadPlaceholder.configure({
        uploadFile: stableUploadFile,
      }),
      DocumentLink.configure({ navigate: stableNavigate }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type / for commands, or press Space for AI...",
        emptyEditorClass: "is-editor-empty text-gray-400",
        emptyNodeClass: "is-empty text-gray-400",
      }),
      SlashCommand.configure({
        suggestion: getSuggestion({
          ai: showAiTools,
          uploadFile: stableUploadFile,
        }),
      }),
      Collaboration.configure({
        document: ydoc,
      }),
    ];

    // 协同模式下添加光标扩展
    if (collabConfig && awarenessUser && provider) {
      exts.push(
        CollaborationCaret.configure({
          provider,
          user: awarenessUser,
        })
      );
    }

    return exts;
  }, [
    placeholder,
    ydoc,
    showAiTools,
    awarenessUser,
    provider,
    collabConfig,
    stableNavigate,
    stableUploadFile,
  ]);

  // 创建编辑器 - 使用 editorKey 作为依赖
  const editor = useEditor(
    {
      editable: !readonly,
      extensions,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          spellcheck: "false",
          class: "tiptap !pl-10",
        },
        handleClick: handleLinkClick,
      },
      onCreate: ({ editor: e }) => {
        onCreate?.(e);
      },
      onUpdate: ({ editor: e }) => {
        onUpdateRef.current?.(e);
      },
      onContentError: ({ error }) => {
        toast.error("编辑器内容错误", {
          description: error.message,
        });
      },
    },
    [editorKey, provider, readonly]
  );

  /** editor 挂载后 CollaborationCaret 插件 init 会覆盖 awareness，再同步一次 avatar */
  useEffect(() => {
    if (!editor || !provider || !awarenessUser || !collabConfig) {
      return;
    }
    provider.setAwarenessField("user", awarenessUser);
  }, [editor, provider, awarenessUser, collabConfig]);

  const { handleSlashCommand, onDragHandleNodeChange } =
    useSlashCommandTrigger(editor);

  // 应用初始内容
  const initialContentAppliedRef = useRef(false);
  useEffect(() => {
    initialContentAppliedRef.current = false;
  }, [editorKey]);

  useEffect(() => {
    const hasFinishedInitialSync = collabConfig ? isWebSocketSynced : true;

    if (
      !editor ||
      initialContentAppliedRef.current ||
      !hasFinishedInitialSync
    ) {
      return;
    }

    if (initialContent) {
      if (!collabConfig) {
        const xmlFragment = ydoc.get("default", Y.XmlFragment);
        if (xmlFragment.length === 0) {
          // 本地 / HTTP 降级：yjsState 未恢复时再落 content JSON
          try {
            const contentJson = JSON.parse(initialContent);
            editor.commands.setContent(contentJson, { emitUpdate: false });
          } catch {
            // 保持空文档并继续展示，避免整页卡住
          }
        }
      } else {
        const xmlFragment = ydoc.get("default", Y.XmlFragment);
        const shouldApplyInitialContent =
          editor.isEmpty || xmlFragment.length === 0;

        if (shouldApplyInitialContent) {
          try {
            const contentJson = JSON.parse(initialContent);
            editor.commands.setContent(contentJson, { emitUpdate: false });
          } catch {
            // 保持空文档并继续展示，避免整页卡住
          }
        }
      }
    }

    initialContentAppliedRef.current = true;
    const scheduleReady = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isMountedRef.current) {
            return;
          }
          setIsCommentUiEnabled(true);
          onEditorReadyRef.current?.();
        });
      });
    };
    scheduleReady();
  }, [
    collabConfig,
    editor,
    initialContent,
    isWebSocketSynced,
    ydoc,
    editorKey,
  ]);

  useEffect(() => {
    return () => {
      ydoc.destroy();
    };
  }, [ydoc]);

  /**
   * 本地模式下把 ydoc 的二进制状态吐给宿主层，便于落库。
   *
   * - 协同模式下 collab-server 自己写 `yjsState`，跳过；
   * - 这里不做防抖：每次 ydoc 事务都会回调，由宿主按业务节奏防抖再发起 HTTP。
   * - 监听 `update`（增量 + 全量都会触发）；只在不是远端来源时回调，避免初始化阶段
   *   把 setContent 触发的内部 transaction 也上报（initialContentAppliedRef 已经处理
   *   首次 setContent，但订阅在 effect 注册后也会立刻收到一次，宿主负责忽略首帧）。
   */
  useEffect(() => {
    if (collabConfig && !enableHttpPersistence) {
      return;
    }
    const handleUpdate = (
      _update: Uint8Array,
      _origin: unknown,
      _doc: Y.Doc
    ) => {
      const cb = onLocalYjsStateRef.current;
      if (!cb) {
        return;
      }
      try {
        cb(Y.encodeStateAsUpdate(ydoc));
      } catch {
        // 单次序列化失败不应阻断后续编辑
      }
    };
    ydoc.on("update", handleUpdate);
    return () => {
      ydoc.off("update", handleUpdate);
    };
  }, [collabConfig, enableHttpPersistence, ydoc]);

  // 更新编辑器的可编辑状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly);
    }
  }, [editor, readonly]);

  if (!isClientReady) {
    return null;
  }

  if (readonly) {
    return (
      <div className={className}>
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert focus:outline-none max-w-full z-0"
        />
        <TableOfContents editor={editor} />
        <ImagePreviewPortal />
        <SearchReplacePanel editor={editor} readonly />
        <LinkConfirmDialog />
      </div>
    );
  }

  return (
    <div className={className} key={editorKey}>
      <ImagePreviewPortal />
      <LinkConfirmDialog />
      {/* 编辑器主体 */}
      {editor && (
        <>
          <CommentBlockMarginTrigger
            currentUser={user}
            documentId={documentId}
            editor={editor}
            highlightBlockId={highlightBlockId}
            highlightCommentId={highlightCommentId}
            mentionableUsers={mentionableUsers}
            onCommentMentionNotify={onCommentMentionNotify}
            uiEnabled={isCommentUiEnabled}
            ydoc={ydoc}
          />
          <BlockDragHandleToolbar
            editor={editor}
            onAddClick={handleSlashCommand}
            onDragHandleNodeChange={onDragHandleNodeChange}
          />
          <EditorContent
            editor={editor}
            className="prose dark:prose-invert focus:outline-none max-w-full z-0"
          />
          <TableHandle editor={editor} />
          <DefaultBubbleMenu editor={editor} />
          <MediaBubbleMenu editor={editor} />
          <CodeBlockBubbleMenu editor={editor} />
          <TableOfContents editor={editor} />
          <AIPanel editor={editor} aiApiUrl={aiApiUrl} />
          <SearchReplacePanel editor={editor} readonly={readonly} />
        </>
      )}
    </div>
  );
}

export default UnifiedEditor;