import { offset } from "@floating-ui/dom";
import { HocuspocusProvider } from "@hocuspocus/provider";
import DragHandle from "@tiptap/extension-drag-handle-react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import { GripVerticalIcon, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { defaultExtensions } from "./tiptap/default-extensions";
import { Ai } from "./tiptap/extensions/ai";
import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import { TableOfContents } from "./components/table-of-contents";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";
import "./styles/tiptap-editor.css";
export interface CollaborativeUser {
  name: string;
  color: string;
  avatar?: string;
}

export interface CollaborativeEditorProps {
  documentId: string;
  token: string;
  user: CollaborativeUser;
  /** WebSocket URL for the Hocuspocus server (e.g., ws://localhost:1234 or wss://your-domain.com/collab) */
  serverUrl: string;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  onSynced?: () => void;
  onDisconnect?: () => void;
  onConnectedUsersChange?: (users: CollaborativeUser[]) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  className?: string;
  showAiTools?: boolean;
  aiApiUrl?: string;
  uploadFile?: (file: File) => Promise<string>;
  readonly?: boolean;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * 协同编辑器组件
 * 支持多人实时协同编辑，基于 Yjs + Hocuspocus
 */
export function CollaborativeEditor({
  documentId,
  token,
  user,
  serverUrl,
  placeholder,
  onCreate,
  onUpdate,
  onSynced,
  onDisconnect,
  onConnectedUsersChange,
  onConnectionStatusChange,
  className = "",
  showAiTools = true,
  aiApiUrl,
  uploadFile,
  readonly = false,
}: CollaborativeEditorProps) {
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  // 使用 refs 稳定回调函数，防止 provider 重新创建
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;
  const onConnectedUsersChangeRef = useRef(onConnectedUsersChange);
  onConnectedUsersChangeRef.current = onConnectedUsersChange;
  const onConnectionStatusChangeRef = useRef(onConnectionStatusChange);
  onConnectionStatusChangeRef.current = onConnectionStatusChange;

  const stableUploadFile = useRef(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }).current;

  const isMountedRef = useRef(false);
  const connectedUsersSigRef = useRef("");
  const lastAwarenessUserSigRef = useRef("");

  // 创建 Yjs 文档 - 使用 documentId 作为依赖，切换文档时重新创建
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  // IndexedDB 离线持久化状态
  const [isIndexedDBSynced, setIsIndexedDBSynced] = useState(false);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  // 初始化 IndexedDB 持久化
  useEffect(() => {
    if (!documentId) return;

    setIsIndexedDBSynced(false);
    const persistence = new IndexeddbPersistence(
      `collab-editor-${documentId}`,
      ydoc
    );
    persistenceRef.current = persistence;

    persistence.on("synced", () => {
      console.log(`[IndexedDB] Local data synced for ${documentId}`);
      setIsIndexedDBSynced(true);
    });

    return () => {
      persistence.destroy();
      persistenceRef.current = null;
    };
  }, [documentId, ydoc]);

  // 创建 Hocuspocus Provider
  const provider = useMemo(() => {
    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token,
      onStatus: ({ status: s }) => {
        // 只有在组件挂载后才更新状态
        if (isMountedRef.current) {
          const newStatus = s as ConnectionStatus;
          onConnectionStatusChangeRef.current?.(newStatus);
          if (s === "disconnected") {
            onDisconnectRef.current?.();
          }
        }
      },
      onSynced: ({ state }) => {
        if (state && isMountedRef.current) {
          onSyncedRef.current?.();
        }
      },
      onAwarenessUpdate: ({ states }) => {
        // 更新在线用户列表（使用 requestAnimationFrame 延迟更新，避免循环）
        if (isMountedRef.current) {
          requestAnimationFrame(() => {
            if (!isMountedRef.current) return;
            const users = Array.from(states.values())
              .filter(
                (state: Record<string, unknown>) =>
                  state.user && (state.user as Record<string, unknown>).name
              )
              .map(
                (state: Record<string, unknown>) =>
                  state.user as CollaborativeUser
              );

            // 注意：awareness 会在光标移动/输入时高频触发，这里只在“用户列表”发生变化时才 setState，
            // 否则会导致整个 React 树频繁 rerender，表现为协同光标闪烁、菜单难以稳定弹出。
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
          });
        }
      },
      onAuthenticationFailed: ({ reason }) => {
        if (isMountedRef.current) {
          toast.error("认证失败", {
            description: reason || "无法连接到协同服务器",
          });
        }
      },
    });

    return p;
  }, [documentId, serverUrl, token, ydoc]);

  // 标记组件已挂载
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 在 useEffect 中设置 awareness 状态，避免在渲染期间触发更新
  useEffect(() => {
    if (provider && isMountedRef.current) {
      const sig = `${user.name}|${user.color}|${
        typeof user.avatar === "string" ? user.avatar : ""
      }`;
      if (sig !== lastAwarenessUserSigRef.current) {
        lastAwarenessUserSigRef.current = sig;
        provider.setAwarenessField("user", user);
      }
    }
  }, [provider, user.name, user.color, user.avatar]);

  const extensions = useMemo(() => {
    const baseExtensions = [
      ...defaultExtensions,
      Placeholder.configure({
        placeholder: placeholder ?? "Type / for commands...",
        emptyEditorClass: "is-editor-empty text-gray-400",
        emptyNodeClass: "is-empty text-gray-400",
      }),
      Ai.configure({
        apiUrl: aiApiUrl,
        onError: (error) => {
          console.error(error);
          toast.error("Error", {
            description: error.message,
          });
        },
      }),
      SlashCommand.configure({
        suggestion: getSuggestion({
          ai: showAiTools,
          uploadFile: uploadFile ? stableUploadFile : undefined,
        }),
      }),
      // Yjs 协同扩展
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCaret.configure({
        provider,
        user: {
          name: user.name,
          color: user.color,
        },
      }),
    ];
    return baseExtensions;
  }, [
    placeholder,
    aiApiUrl,
    showAiTools,
    stableUploadFile,
    ydoc,
    provider,
    user.name,
    user.color,
  ]);

  // 创建编辑器 - 保持 editor 实例稳定（不要把连接状态放进 useEditor 依赖，避免频繁重建导致闪烁/菜单失效）
  const editor = useEditor(
    {
      editable: !readonly,
      extensions,
      immediatelyRender: false, // 协同模式下禁用立即渲染
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
        onUpdate?.(e);
      },
      onContentError: ({ error }) => {
        toast.error("编辑器内容错误", {
          description: error.message,
        });
      },
    },
    [extensions, readonly]
  );

  const { handleSlashCommand } = useSlashCommandTrigger(editor);

  // 清理
  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  // 更新编辑器的可编辑状态（仅由 readonly 控制，避免连接抖动导致菜单/光标闪烁）
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly);
    }
  }, [editor, readonly]);

  // 等待 IndexedDB 同步完成后再渲染编辑器
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
    <div className={className}>
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
          <DefaultBubbleMenu editor={editor} showAiTools={showAiTools} />
          <MediaBubbleMenu editor={editor} />
          <TableOfContents editor={editor} />
        </>
      )}
    </div>
  );
}

export default CollaborativeEditor;
