import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import * as Y from "yjs";
import { encodeStateAsUpdate } from "../lib/yjs-utils";

interface CollabConfig {
  serverUrl: string;
  token: string;
}

export interface UseEditorContentSyncParams {
  editor: Editor | null;
  ydoc: Y.Doc;
  editorKey: string;
  collabConfig: CollabConfig | null;
  initialContent?: string;
  isWebSocketSynced: boolean;
  /** 由主组件维护（http-yjsState 预灌 effect 写入），content-sync 只读 */
  httpYjsStateApplied: boolean;
  isMountedRef: React.MutableRefObject<boolean>;
  readonly?: boolean;
  enableHttpPersistence?: boolean;
  onLocalYjsState?: (state: Uint8Array) => void;
  onEditorReady?: () => void;
}

export interface UseEditorContentSyncResult {
  isContentLoaded: boolean;
  isCommentUiEnabled: boolean;
  initialContentAppliedRef: React.MutableRefObject<boolean>;
}

/**
 * 管理编辑器内容初始化与同步时序（editor 创建之后的部分）。
 *
 * 注意：HTTP yjsState 预灌（`httpYjsStateApplied`）必须在 `useEditor` 创建
 * 编辑器实例之前执行，否则编辑器会先以空文档创建、再经 Collaboration 更新
 * 流入内容，触发多余的 onUpdate 事务。因此该 effect 留在主组件中
 * （声明于 useEditor 之前），本 hook 仅消费其结果 `httpYjsStateApplied`。
 *
 * 本 hook 负责：
 * - content vs yjsState 优先级判断（协同只信 Yjs，本地降级才落 content JSON）；
 * - `isContentLoaded` 控制 editable；内容就绪后双 rAF 触发 `onEditorReady` + 评论 UI；
 * - 本地模式下把 ydoc 二进制状态上报宿主层（`onLocalYjsState`）。
 */
export function useEditorContentSync({
  editor,
  ydoc,
  editorKey,
  collabConfig,
  initialContent,
  isWebSocketSynced,
  httpYjsStateApplied,
  isMountedRef,
  readonly = false,
  enableHttpPersistence = false,
  onLocalYjsState,
  onEditorReady,
}: UseEditorContentSyncParams): UseEditorContentSyncResult {
  const onLocalYjsStateRef = useRef(onLocalYjsState);
  onLocalYjsStateRef.current = onLocalYjsState;
  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  // 内容是否已加载完成（协同同步完成或本地内容已应用）
  const [isContentLoaded, setIsContentLoaded] = useState(false);
  const [isCommentUiEnabled, setIsCommentUiEnabled] = useState(false);

  // 应用初始内容
  const initialContentAppliedRef = useRef(false);

  // editorKey / collabConfig 切换时重置评论 UI（content 部分）
  useEffect(() => {
    setIsCommentUiEnabled(false);
  }, [editorKey, collabConfig]);

  useEffect(() => {
    setIsContentLoaded(false);
  }, [editorKey]);

  useEffect(() => {
    initialContentAppliedRef.current = false;
  }, [editorKey]);

  useEffect(() => {
    // 协同模式：WS 同步完成或 HTTP yjsState 已预灌 ydoc 均可展示内容
    const hasFinishedInitialSync = collabConfig
      ? isWebSocketSynced || httpYjsStateApplied
      : true;

    if (
      !editor ||
      initialContentAppliedRef.current ||
      !hasFinishedInitialSync
    ) {
      return;
    }

    if (collabConfig) {
      // 协同模式正文只来自 Hocuspocus/Yjs，禁止 setContent 以免与 WS 同步状态合并重复
      initialContentAppliedRef.current = true;
      setIsContentLoaded(true);
    } else if (initialContent) {
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
      initialContentAppliedRef.current = true;
      setIsContentLoaded(true);
    } else {
      initialContentAppliedRef.current = true;
      setIsContentLoaded(true);
    }
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
    httpYjsStateApplied,
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
        cb(encodeStateAsUpdate(ydoc));
      } catch {
        // 单次序列化失败不应阻断后续编辑
      }
    };
    ydoc.on("update", handleUpdate);
    return () => {
      ydoc.off("update", handleUpdate);
    };
  }, [collabConfig, enableHttpPersistence, ydoc]);

  // 更新编辑器的可编辑状态：内容未就绪时禁止编辑，避免空白文档可输入
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readonly && isContentLoaded);
    }
  }, [editor, readonly, isContentLoaded]);

  return {
    isContentLoaded,
    isCommentUiEnabled,
    initialContentAppliedRef,
  };
}
