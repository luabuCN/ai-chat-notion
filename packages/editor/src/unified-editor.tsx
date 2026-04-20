import { offset } from "@floating-ui/dom";
import { HocuspocusProvider } from "@hocuspocus/provider";
import DragHandle from "@tiptap/extension-drag-handle-react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import { GripVerticalIcon, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { defaultExtensions } from "./tiptap/default-extensions";
import { DocumentLink } from "./tiptap/extensions/document-link";
import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import AIPanel from "./components/ai-panel";
import { TableOfContents } from "./components/table-of-contents";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";
import "./styles/tiptap-editor.css";
import { CodeBlockBubbleMenu } from "./tiptap/menus/codeblock-bubble-menu";

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

export interface UnifiedEditorProps {
  documentId: string;
  initialContent?: string;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  onIndexedDBSynced?: () => void;
  onWebSocketSynced?: () => void;
  onDisconnect?: () => void;
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
}

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
  placeholder,
  onCreate,
  onUpdate,
  onIndexedDBSynced,
  onWebSocketSynced,
  onDisconnect,
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

  const onIndexedDBSyncedRef = useRef(onIndexedDBSynced);
  onIndexedDBSyncedRef.current = onIndexedDBSynced;
  const onWebSocketSyncedRef = useRef(onWebSocketSynced);
  onWebSocketSyncedRef.current = onWebSocketSynced;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;
  const onConnectedUsersChangeRef = useRef(onConnectedUsersChange);
  onConnectedUsersChangeRef.current = onConnectedUsersChange;
  const onConnectionStatusChangeRef = useRef(onConnectionStatusChange);
  onConnectionStatusChangeRef.current = onConnectionStatusChange;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const userRef = useRef(user);
  userRef.current = user;

  const stableUploadFile = useCallback(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }, []);

  const isMountedRef = useRef(false);
  const connectedUsersSigRef = useRef("");

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

  // 创建 Yjs 文档
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  // IndexedDB 状态
  const [isIndexedDBSynced, setIsIndexedDBSynced] = useState(false);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const [isWebSocketSynced, setIsWebSocketSynced] = useState(!collabConfig);

  // 延迟渲染状态
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClientReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // 初始化 IndexedDB
  useEffect(() => {
    if (!documentId) return;

    setIsIndexedDBSynced(false);
    const persistence = new IndexeddbPersistence(
      `unified-editor-${documentId}`,
      ydoc
    );
    persistenceRef.current = persistence;

    persistence.on("synced", () => {
      console.log(`[IndexedDB] Local data synced for ${documentId}`);
      if (isMountedRef.current) {
        setIsIndexedDBSynced(true);
        onIndexedDBSyncedRef.current?.();
      }
    });

    return () => {
      persistence.destroy();
      persistenceRef.current = null;
    };
  }, [documentId, ydoc]);

  useEffect(() => {
    connectedUsersSigRef.current = "";
    setIsWebSocketSynced(!collabConfig);
  }, [editorKey, collabConfig]);

  // 创建 Provider - 依赖 documentId 和 collabConfig
  // 当协同模式切换时，provider 也会重新创建
  const provider = useMemo(() => {
    const serverUrl =
      collabConfig?.serverUrl ||
      process.env.NEXT_PUBLIC_HOCUSPOCUS_URL ||
      "ws://localhost:1234";

    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token: collabConfig?.token || "",
      onStatus: ({ status: s }) => {
        setTimeout(() => {
          if (!isMountedRef.current) return;
          const newStatus = s as ConnectionStatus;
          setConnectionStatus(newStatus);
          onConnectionStatusChangeRef.current?.(newStatus);
          if (s === "disconnected") {
            onDisconnectRef.current?.();
          }
        }, 0);
      },
      onSynced: ({ state }) => {
        setTimeout(() => {
          if (!isMountedRef.current) return;
          if (state) {
            setIsWebSocketSynced(true);
            onWebSocketSyncedRef.current?.();
          }
        }, 0);
      },
      onAwarenessUpdate: ({ states }) => {
        setTimeout(() => {
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

          /** 同一用户可能对应多个 awareness 客户端（多标签、热更新、短暂重连），展示层按人合并 */
          const byKey = new Map<string, CollaborativeUser>();
          for (const u of raw) {
            const key = `${u.name}|${u.color}|${
              typeof u.avatar === "string" ? u.avatar : ""
            }`;
            if (!byKey.has(key)) {
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
          if (!isMountedRef.current) return;
          toast.error("认证失败", {
            description: reason || "无法连接到协同服务器",
          });
        }, 0);
      },
    });

    // 设置用户 awareness
    if (userRef.current) {
      p.setAwarenessField("user", userRef.current);
    }

    // 如果没有协同配置，断开连接（本地模式）
    if (!collabConfig) {
      p.disconnect();
    }

    return p;
  }, [documentId, ydoc, collabConfig?.serverUrl, collabConfig?.token]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 更新 awareness
  useEffect(() => {
    if (provider && user) {
      provider.setAwarenessField("user", user);
    }
  }, [provider, user]);

  // Extensions
  const extensions = useMemo(() => {
    const exts = [
      ...defaultExtensions,
      DocumentLink.configure({ navigate: stableNavigate }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type / for commands...",
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
    if (collabConfig && user && provider) {
      exts.push(
        CollaborationCaret.configure({
          provider,
          user: {
            name: user.name,
            color: user.color,
          },
        })
      );
    }

    return exts;
  }, [
    placeholder,
    ydoc,
    showAiTools,
    user,
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
    [editorKey, readonly]
  );

  const { handleSlashCommand } = useSlashCommandTrigger(editor);

  // 应用初始内容
  const initialContentAppliedRef = useRef(false);
  useEffect(() => {
    initialContentAppliedRef.current = false;
  }, [editorKey]);

  useEffect(() => {
    const hasFinishedInitialSync = collabConfig
      ? isIndexedDBSynced && isWebSocketSynced
      : isIndexedDBSynced;

    if (
      !editor ||
      !initialContent ||
      initialContentAppliedRef.current ||
      !hasFinishedInitialSync
    )
      return;

    const xmlFragment = ydoc.get("default", Y.XmlFragment);
    const shouldApplyInitialContent = editor.isEmpty || xmlFragment.length === 0;

    if (shouldApplyInitialContent) {
      console.log("[UnifiedEditor] Applying initial content");
      try {
        const contentJson = JSON.parse(initialContent);
        editor.commands.setContent(contentJson, { emitUpdate: false });
      } catch (e) {
        console.error("[UnifiedEditor] Failed to parse initial content", e);
      }
    }
    initialContentAppliedRef.current = true;
  }, [
    collabConfig,
    editor,
    initialContent,
    isIndexedDBSynced,
    isWebSocketSynced,
    ydoc,
  ]);

  // 清理
  useEffect(() => {
    return () => {
      if (provider) {
        provider.disconnect();
        provider.destroy();
      }
    };
  }, [provider]);

  useEffect(() => {
    return () => {
      ydoc.destroy();
    };
  }, [ydoc]);

  // 更新编辑器的可编辑状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly);
    }
  }, [editor, readonly]);

  if (!isClientReady) {
    return null;
  }

  if (!isIndexedDBSynced) {
    return (
      <div
        className={`${className} flex items-center justify-center min-h-[200px]`}
      >
        <div className="text-center text-muted-foreground">
          <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full mx-auto mb-2" />
          <span className="text-sm">加载本地数据...</span>
        </div>
      </div>
    );
  }

  if (readonly) {
    return (
      <div className={className}>
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert focus:outline-none max-w-full z-0"
        />
        <TableOfContents editor={editor} />
      </div>
    );
  }

  return (
    <div className={className} key={editorKey}>
      {/* 编辑器主体 */}
      {editor && (
        <>
          <DragHandle
            editor={editor}
            className="transition-all duration-300 ease-in-out"
            computePositionConfig={{
              middleware: [offset(20)],
            }}
          >
            <div className="flex items-center gap-1 -ml-2">
              <button
                type="button"
                className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-pointer transition-colors border shadow-sm"
                onClick={handleSlashCommand}
              >
                <Plus className="size-3.5 text-muted-foreground" />
              </button>
              <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-grab transition-colors border shadow-sm">
                <GripVerticalIcon className="size-3.5 text-muted-foreground" />
              </div>
            </div>
          </DragHandle>
          <EditorContent
            editor={editor}
            className="prose dark:prose-invert focus:outline-none max-w-full z-0"
          />
          <TableHandle editor={editor} />
          <DefaultBubbleMenu editor={editor} />
          <MediaBubbleMenu editor={editor} />
          <CodeBlockBubbleMenu editor={editor} />
          <TableOfContents editor={editor} />
          <AIPanel editor={editor} />
        </>
      )}
    </div>
  );
}

export default UnifiedEditor;