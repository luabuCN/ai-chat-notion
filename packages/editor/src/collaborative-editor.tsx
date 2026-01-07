import { offset } from "@floating-ui/dom";
import { HocuspocusProvider } from "@hocuspocus/provider";
import DragHandle from "@tiptap/extension-drag-handle-react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Placeholder } from "@tiptap/extensions";
import { Content, Editor, EditorContent, useEditor } from "@tiptap/react";
import { GripVerticalIcon, Plus, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as Y from "yjs";
import { defaultExtensions } from "./tiptap/default-extensions";
import { Ai } from "./tiptap/extensions/ai";
import {
  getSuggestion,
  SlashCommand,
} from "./tiptap/extensions/slash-command";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import { TableOfContents } from "./components/table-of-contents";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";

export interface CollaborativeUser {
  name: string;
  color: string;
  avatar?: string;
}

export interface CollaborativeEditorProps {
  documentId: string;
  token: string;
  user: CollaborativeUser;
  serverUrl?: string;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  onSynced?: () => void;
  onDisconnect?: () => void;
  className?: string;
  showAiTools?: boolean;
  aiApiUrl?: string;
  uploadFile?: (file: File) => Promise<string>;
  readonly?: boolean;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * 生成用户颜色（基于字符串生成一致的颜色）
 */
export function generateUserColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * 协同编辑器组件
 * 支持多人实时协同编辑，基于 Yjs + Hocuspocus
 */
export function CollaborativeEditor({
  documentId,
  token,
  user,
  serverUrl = "ws://localhost:1234",
  placeholder,
  onCreate,
  onUpdate,
  onSynced,
  onDisconnect,
  className = "",
  showAiTools = true,
  aiApiUrl,
  uploadFile,
  readonly = false,
}: CollaborativeEditorProps) {
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  const stableUploadFile = useRef(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }).current;

  // 连接状态
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [connectedUsers, setConnectedUsers] = useState<CollaborativeUser[]>([]);

  // 创建 Yjs 文档 - 使用 documentId 作为依赖，切换文档时重新创建
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  // 创建 Hocuspocus Provider
  const provider = useMemo(() => {
    const p = new HocuspocusProvider({
      url: serverUrl,
      name: documentId,
      document: ydoc,
      token,
      onStatus: ({ status: s }) => {
        console.log("[Collab] Connection status:", s);
        setStatus(s as ConnectionStatus);
        if (s === "disconnected") {
          onDisconnect?.();
        }
      },
      onSynced: ({ state }) => {
        console.log("[Collab] Document synced, state:", state);
        if (state) {
          onSynced?.();
        }
      },
      onAwarenessUpdate: ({ states }) => {
        // 更新在线用户列表
        const users = Array.from(states.values())
          .filter(
            (state: Record<string, unknown>) =>
              state.user && (state.user as Record<string, unknown>).name
          )
          .map((state: Record<string, unknown>) => state.user as CollaborativeUser);
        setConnectedUsers(users);
      },
      onAuthenticationFailed: ({ reason }) => {
        console.error("[Collab] Authentication failed:", reason);
        toast.error("认证失败", {
          description: reason || "无法连接到协同服务器",
        });
      },
    });

    // 设置当前用户的 awareness 状态
    p.setAwarenessField("user", user);

    return p;
  }, [documentId, serverUrl, token, ydoc, user, onSynced, onDisconnect]);

  // 创建编辑器
  const editor = useEditor(
    {
      editable: !readonly && status === "connected",
      extensions: [
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
        // 协作光标扩展
        CollaborationCursor.configure({
          provider,
          user: {
            name: user.name,
            color: user.color,
          },
        }),
      ],
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
        console.error(error);
      },
    },
    [ydoc, provider, readonly, status]
  );

  const { handleSlashCommand } = useSlashCommandTrigger(editor);

  // 清理
  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  // 更新编辑器的可编辑状态
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly && status === "connected");
    }
  }, [editor, readonly, status]);

  // 连接状态指示器
  const ConnectionIndicator = useCallback(() => {
    const statusConfig = {
      connecting: {
        icon: <Wifi className="size-3.5 animate-pulse" />,
        text: "连接中...",
        className: "text-yellow-500",
      },
      connected: {
        icon: <Wifi className="size-3.5" />,
        text: `${connectedUsers.length} 人在线`,
        className: "text-green-500",
      },
      disconnected: {
        icon: <WifiOff className="size-3.5" />,
        text: "已断开",
        className: "text-red-500",
      },
    };

    const config = statusConfig[status];

    return (
      <div
        className={`flex items-center gap-1.5 text-xs ${config.className}`}
        title={config.text}
      >
        {config.icon}
        <span>{config.text}</span>
      </div>
    );
  }, [status, connectedUsers.length]);

  // 在线用户头像列表
  const OnlineUsers = useCallback(() => {
    if (connectedUsers.length === 0) return null;

    return (
      <div className="flex -space-x-2">
        {connectedUsers.slice(0, 5).map((u, index) => (
          <div
            key={`${u.name}-${index}`}
            className="size-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
            style={{ backgroundColor: u.color }}
            title={u.name}
          >
            {u.avatar ? (
              <img
                src={u.avatar}
                alt={u.name}
                className="size-full rounded-full object-cover"
              />
            ) : (
              u.name.charAt(0).toUpperCase()
            )}
          </div>
        ))}
        {connectedUsers.length > 5 && (
          <div className="size-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
            +{connectedUsers.length - 5}
          </div>
        )}
      </div>
    );
  }, [connectedUsers]);

  if (readonly) {
    return (
      <div className={className}>
        <div className="flex items-center justify-end gap-3 mb-2 px-2">
          <OnlineUsers />
          <ConnectionIndicator />
        </div>
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
      {/* 协同状态栏 */}
      <div className="flex items-center justify-end gap-3 mb-2 px-2">
        <OnlineUsers />
        <ConnectionIndicator />
      </div>

      {/* 编辑器主体 */}
      <DragHandle
        editor={editor}
        className="transition-all duration-300 ease-in-out"
        computePositionConfig={{
          middleware: [offset(20)],
        }}
      >
        <div className="flex items-center gap-1 -ml-2">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-pointer transition-colors border shadow-sm"
            onClick={handleSlashCommand}
          >
            <Plus className="size-3.5 text-muted-foreground" />
          </div>
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
    </div>
  );
}

export default CollaborativeEditor;

