import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Placeholder } from "@tiptap/extensions";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import {
  useCallback,
  useEffect,
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
import { decodeBase64ToUint8Array } from "./lib/yjs-utils";
import { useIndexeddbPersistence } from "./hooks/use-indexeddb-persistence";
import {
  useCollaborationAwareness,
  type CollaborativeUser,
} from "./hooks/use-collaboration-awareness";
import {
  useHocuspocusProvider,
  type ConnectionStatus,
} from "./hooks/use-hocuspocus-provider";
import { useEditorContentSync } from "./hooks/use-editor-content-sync";

export type { CollaborativeUser, ConnectionStatus, CommentMentionNotifyParams };

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

/**
 * 统一编辑器组件
 *
 * - Editor 的 key 使用 documentId + (collabConfig ? 'collab' : 'local')，
 *   切换协同模式时重新创建 editor（避免 awareness 错误）。
 * - 协同连接 / awareness / 内容同步逻辑分别拆分至 useHocuspocusProvider /
 *   useCollaborationAwareness / useEditorContentSync。
 *
 * 注意：HTTP yjsState 预灌 effect 保留在本组件中、且声明于 useEditor 之前——
 * TipTap v3 的 useEditor 在 useEffect 中创建编辑器实例，预灌必须先于该 effect
 * 执行，编辑器才能以已填充的 ydoc 创建（避免多余的 onUpdate 事务）。
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

  const stableUploadFile = useCallback(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }, []);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  /** 写入 Yjs awareness 的用户信息；CollaborationCaret 会覆盖 `user` 字段，必须含 avatar */
  const awarenessUser = useMemo(() => {
    if (!user) {
      return null;
    }
    return {
      name: user.name,
      color: user.color,
      ...(user.avatar ? { avatar: user.avatar } : {}),
      ...(user.email ? { email: user.email } : {}),
    };
  }, [user]);

  // 编辑器版本 key：documentId + 协同模式
  const editorKey = useMemo(
    () => `${documentId}-${collabConfig ? "collab" : "local"}`,
    [documentId, collabConfig]
  );

  // 创建 Yjs 文档
  // - 非协同模式：从 initialYjsStateB64 预灌正文（yjsState 变化时重建）
  // - 协同模式：ydoc 为空壳，yjsState 由下方 useEffect 应用（避免 yjsState 到达时重建 ydoc 导致 WS 重连）
  const yjsStateSignature = collabConfig
    ? "collab"
    : initialYjsStateB64 ?? "empty";
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
  }, [collabConfig, documentId, yjsStateSignature]);

  // y-indexeddb 作为客户端读取缓存层，不替代服务端持久化。
  const { isRestored } = useIndexeddbPersistence(ydoc, documentId, readonly);

  const { handleAwarenessUpdate, resetSignature } =
    useCollaborationAwareness(onConnectedUsersChange);

  // editorKey / collabConfig 切换时重置 awareness 用户签名
  useEffect(() => {
    resetSignature();
  }, [editorKey, collabConfig]);

  /** 协同模式下 HTTP yjsState 是否已应用到 ydoc（provider 5s 兜底定时器读取） */
  const httpYjsStateAppliedRef = useRef(false);
  const [httpYjsStateApplied, setHttpYjsStateApplied] = useState(false);

  // editorKey / collabConfig 切换时重置 yjsState 预灌状态（须先于下方 http-yjsState effect）
  useEffect(() => {
    httpYjsStateAppliedRef.current = false;
    setHttpYjsStateApplied(false);
  }, [editorKey, collabConfig]);

  /**
   * 协同模式下用 HTTP yjsState 预灌 ydoc（Provider 创建前执行），使 ydoc 已有内容；
   * WS 同步到达后 Yjs CRDT 自动合并（幂等）。须声明于 useEditor 之前（见组件注释）。
   */
  useEffect(() => {
    if (!collabConfig || !initialYjsStateB64) {
      httpYjsStateAppliedRef.current = false;
      setHttpYjsStateApplied(false);
      return;
    }
    try {
      Y.applyUpdate(ydoc, decodeBase64ToUint8Array(initialYjsStateB64));
    } catch {
      // 解码失败时继续等待 WS 同步
    }
    httpYjsStateAppliedRef.current = true;
    setHttpYjsStateApplied(true);
  }, [collabConfig, initialYjsStateB64, ydoc]);

  const {
    provider,
    isWebSocketSynced,
    isClientReady,
    isMountedRef,
  } = useHocuspocusProvider({
    documentId,
    ydoc,
    collabConfig: collabConfig ?? null,
    isRestored,
    readonly,
    editorKey,
    user,
    awarenessUser,
    handleAwarenessUpdate,
    httpYjsStateAppliedRef,
    onConnectionStatusChange,
    onWebSocketSynced,
    onDisconnect,
    onPermissionRevoked,
  });

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

  const { isCommentUiEnabled } = useEditorContentSync({
    editor,
    ydoc,
    editorKey,
    collabConfig: collabConfig ?? null,
    initialContent,
    isWebSocketSynced,
    httpYjsStateApplied,
    isMountedRef,
    readonly,
    enableHttpPersistence,
    onLocalYjsState,
    onEditorReady,
  });

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
