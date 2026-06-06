import type { Editor } from "@tiptap/core";
import { MessageSquareTextIcon } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type * as Y from "yjs";
import { Button } from "@repo/ui/button";
import { cn, generateUUID } from "../../lib/utils";
import { useAIPanelStore } from "../ai-panel/ai-panel-store";
import type { CommentMarginCueGeom } from "./comment-margin-types";
import {
  buildMarginCueGeomForBlockId,
  COMMENT_MARGIN_GAP_PX,
  getCommentAnchorFromPos,
  shouldShowTrailingCommentCue,
} from "./comment-margin-utils";
import {
  CommentPrototypeForm,
  type CommentPrototypeEntry,
} from "./comment-prototype-form";
import { useCommentSelectionHandoffStore } from "./comment-selection-handoff-store";
import {
  addCommentToBlock,
  deleteCommentFromBlock,
  purgeOrphanedCommentThreads,
  useCommentThreadsByBlockId,
} from "./comment-store-yjs";

export type { CommentMarginCueGeom } from "./comment-margin-types";

/** 与 `CollaborativeUser` 同构，避免循环 import */
type CommentPrototypeUser = {
  name: string;
  color: string;
  avatar?: string;
};

type CommentBlockMarginTriggerProps = {
  editor: Editor;
  /**
   * 与正文共享的 Yjs 文档；评论 CRDT 写入此 doc，与协同正文同生命周期。
   * 缺省时退化为只读 UI（hover 触发器可见，但禁止落地评论），便于纯本地预览/旧入口。
   */
  ydoc?: Y.Doc | null;
  /**
   * 正文已完成首帧加载且可交互后再展示评论 UI（portal 在 body 上，否则会叠在骨架屏之上）。
   */
  uiEnabled?: boolean;
  /** 用作评论作者占位 */
  currentUser?: CommentPrototypeUser;
  /** 文档 ID，透传给 CommentPrototypeForm 以获取可提及用户 */
  documentId?: string;
  /** 通知跳转：目标评论 ID */
  highlightCommentId?: string;
  /** 通知跳转：目标评论所在 block ID */
  highlightBlockId?: string;
  /** 可提及的用户列表（由外部提供） */
  mentionableUsers?: Array<{ id: string; name: string; email?: string; avatar?: string }>;
};

const PANEL_WIDTH_PX = 320;
const PANEL_GAP_BELOW_BUTTON_PX = 6;
const HIDE_LIVE_CUE_DELAY_MS = 320;
const BRIDGE_EXTEND_RIGHT_PX = 36;
const BRIDGE_PAD_Y_PX = 14;

function buildSig(geom: CommentMarginCueGeom | null) {
  if (!geom) {
    return "";
  }
  return `${geom.blockId ?? "?"}|${geom.iconLeftPx.toFixed(
    0
  )}|${geom.iconTopPx.toFixed(0)}`;
}

function clampPanelLeft(rawLeft: number, panelWidth: number) {
  const margin = 8;
  const vw =
    typeof window !== "undefined"
      ? window.innerWidth
      : Number.POSITIVE_INFINITY;
  return Math.min(
    Math.max(margin, rawLeft),
    vw - panelWidth - margin
  );
}

function CommentBlockMarginTriggerInner({
  editor,
  ydoc,
  uiEnabled = false,
  currentUser,
  documentId,
  highlightCommentId,
  highlightBlockId,
  mentionableUsers,
}: CommentBlockMarginTriggerProps) {
  const isAiBusy = useAIPanelStore(
    (state) =>
      state.isVisible || state.isThinking || state.isStreaming
  );

  const handoffGeom = useCommentSelectionHandoffStore(
    (state) => state.handoffGeom
  );
  const handoffPanelOpen = useCommentSelectionHandoffStore(
    (state) => state.handoffPanelOpen
  );
  const dismissHandoff = useCommentSelectionHandoffStore(
    (state) => state.dismissHandoff
  );

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [liveCue, setLiveCue] = useState<CommentMarginCueGeom | null>(null);
  const [frozenCue, setFrozenCue] = useState<CommentMarginCueGeom | null>(
    null
  );

  /** 当前固定打开的块 id（来自持久图标点击）；与 frozenCue 互斥 */
  const [pinnedBlockId, setPinnedBlockId] = useState<string | null>(null);

  const threadsByBlockId = useCommentThreadsByBlockId(ydoc);

  const layoutBumpRafRef = useRef<number | undefined>(undefined);
  const [layoutEpoch, setLayoutEpoch] = useState(0);

  const scheduleLayoutBump = useCallback(() => {
    if (layoutBumpRafRef.current !== undefined) {
      return;
    }
    layoutBumpRafRef.current = requestAnimationFrame(() => {
      layoutBumpRafRef.current = undefined;
      setLayoutEpoch((n) => n + 1);
    });
  }, []);

  const effectivePanelOpen = handoffGeom
    ? handoffPanelOpen
    : open || pinnedBlockId !== null;

  const commentedBlockIds = useMemo(() => {
    const result: string[] = [];
    for (const key of Object.keys(threadsByBlockId)) {
      if ((threadsByBlockId[key] ?? []).length > 0) {
        result.push(key);
      }
    }
    return result;
  }, [threadsByBlockId]);

  const commentedBlockIdSet = useMemo(
    () => new Set(commentedBlockIds),
    [commentedBlockIds]
  );

  const persistentGeoms = useMemo(() => {
    const out: { blockId: string; geom: CommentMarginCueGeom }[] = [];
    for (const blockId of commentedBlockIds) {
      const g = buildMarginCueGeomForBlockId(
        editor.view,
        blockId,
        COMMENT_MARGIN_GAP_PX
      );
      if (g) {
        out.push({ blockId, geom: g });
      }
    }
    return out;
    // layoutEpoch 让滚动/transaction 都能触发位置重算
  }, [commentedBlockIds, editor, layoutEpoch]);

  /** 当前活跃锚定块的 id（优先级：handoff → pinned → 浮动 hover/open） */
  const activeBlockId: string | null = handoffGeom
    ? handoffGeom.blockId
    : pinnedBlockId !== null
    ? pinnedBlockId
    : open
    ? frozenCue?.blockId ?? liveCue?.blockId ?? null
    : null;

  const activeAnchorGeom = useMemo<CommentMarginCueGeom | null>(() => {
    if (!activeBlockId) {
      return null;
    }
    const fresh = buildMarginCueGeomForBlockId(
      editor.view,
      activeBlockId,
      COMMENT_MARGIN_GAP_PX
    );
    if (fresh) {
      return fresh;
    }
    if (handoffGeom?.blockId === activeBlockId) {
      return handoffGeom;
    }
    if (frozenCue?.blockId === activeBlockId) {
      return frozenCue;
    }
    if (liveCue?.blockId === activeBlockId) {
      return liveCue;
    }
    return null;
  }, [activeBlockId, editor, frozenCue, handoffGeom, layoutEpoch, liveCue]);

  const hoverPreviewGeom = useMemo(() => {
    if (effectivePanelOpen) {
      return null;
    }
    if (!liveCue) {
      return null;
    }
    if (liveCue.blockId && commentedBlockIdSet.has(liveCue.blockId)) {
      return null;
    }
    // 用 blockId 重算最新位置；blockId 缺失时仅保留原始 cue（按坐标渲染）
    if (liveCue.blockId) {
      const fresh = buildMarginCueGeomForBlockId(
        editor.view,
        liveCue.blockId,
        COMMENT_MARGIN_GAP_PX
      );
      return fresh ?? liveCue;
    }
    return liveCue;
  }, [commentedBlockIdSet, editor, effectivePanelOpen, layoutEpoch, liveCue]);

  /** 与 useLayoutEffect 中的 schedule 联动，保留旧名以最小化下游 diff */
  const displayGeom = activeAnchorGeom ?? hoverPreviewGeom;

  const activeComments: CommentPrototypeEntry[] =
    activeBlockId !== null
      ? threadsByBlockId[activeBlockId] ?? []
      : [];

  const isActiveAnchorCommented =
    activeBlockId !== null && commentedBlockIdSet.has(activeBlockId);

  const activeBlockIdRef = useRef<string | null>(activeBlockId);
  activeBlockIdRef.current = activeBlockId;

  const rafRef = useRef<number | undefined>(undefined);
  const sigRef = useRef("");
  const liveCueRef = useRef<CommentMarginCueGeom | null>(null);
  liveCueRef.current = liveCue;

  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<HTMLDivElement | null>(null);
  const persistentLayerRef = useRef<HTMLDivElement | null>(null);
  const hideLiveCueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pointerOverFloatingUiRef = useRef(false);
  const openRef = useRef(false);

  const clearRaf = () => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  };

  const cancelScheduledHideLiveCue = useCallback(() => {
    if (hideLiveCueTimeoutRef.current !== null) {
      clearTimeout(hideLiveCueTimeoutRef.current);
      hideLiveCueTimeoutRef.current = null;
    }
  }, []);

  const scheduleHideLiveCue = useCallback(() => {
    cancelScheduledHideLiveCue();
    hideLiveCueTimeoutRef.current = setTimeout(() => {
      hideLiveCueTimeoutRef.current = null;
      if (openRef.current) {
        return;
      }
      if (pointerOverFloatingUiRef.current) {
        return;
      }
      sigRef.current = "";
      setLiveCue(null);
    }, HIDE_LIVE_CUE_DELAY_MS);
  }, [cancelScheduledHideLiveCue]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        dismissHandoff();
        setFrozenCue(null);
        setPinnedBlockId(null);
        return;
      }
      if (liveCueRef.current !== null && !handoffGeom) {
        setFrozenCue(liveCueRef.current);
        return;
      }
      setFrozenCue(null);
    },
    [dismissHandoff, handoffGeom]
  );

  const handleOpenToggle = useCallback(() => {
    setOpen((prev) => {
      const nextOpen = !prev;
      if (nextOpen && liveCueRef.current !== null) {
        setFrozenCue(liveCueRef.current);
      }
      if (!nextOpen) {
        setFrozenCue(null);
        dismissHandoff();
        setPinnedBlockId(null);
      }
      return nextOpen;
    });
  }, [dismissHandoff]);

  const handlePersistentClick = useCallback(
    (blockId: string) => {
      if (pinnedBlockId === blockId) {
        handleOpenChange(false);
        return;
      }
      dismissHandoff();
      setFrozenCue(null);
      setOpen(false);
      setPinnedBlockId(blockId);
    },
    [dismissHandoff, handleOpenChange, pinnedBlockId]
  );

  const handlePrototypeAdd = useCallback(
    (body: string, mentions: import("./comment-prototype-form").MentionUser[] = []) => {
      const blockId = activeBlockIdRef.current;
      if (!blockId || !ydoc) {
        return;
      }
      addCommentToBlock(ydoc, blockId, {
        authorAvatar: currentUser?.avatar,
        authorColor: currentUser?.color,
        authorName: currentUser?.name ?? "原型用户",
        body,
        mentions: mentions.length > 0 ? mentions : undefined,
        createdAtMs: Date.now(),
        id: generateUUID(),
      });
    },
    [currentUser?.avatar, currentUser?.color, currentUser?.name, ydoc]
  );

  const handlePrototypeDelete = useCallback(
    (commentId: string) => {
      const blockId = activeBlockIdRef.current;
      if (!blockId || !ydoc) {
        return;
      }
      deleteCommentFromBlock(ydoc, blockId, commentId);
    },
    [ydoc]
  );

  useEffect(() => {
    openRef.current = effectivePanelOpen;
  }, [effectivePanelOpen]);

  const handleAnchorClick = useCallback(() => {
    if (handoffGeom !== null) {
      dismissHandoff();
      setOpen(false);
      setFrozenCue(null);
      setPinnedBlockId(null);
      return;
    }
    if (pinnedBlockId !== null) {
      handleOpenChange(false);
      return;
    }
    handleOpenToggle();
  }, [
    dismissHandoff,
    handleOpenChange,
    handleOpenToggle,
    handoffGeom,
    pinnedBlockId,
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll to highlighted block and pin its comment panel
  useEffect(() => {
    if (!highlightCommentId || !highlightBlockId || !editor?.view) return;

    const geom = buildMarginCueGeomForBlockId(
      editor.view,
      highlightBlockId,
      COMMENT_MARGIN_GAP_PX
    );
    if (geom) {
      try {
        const { node } = editor.view.domAtPos(geom.anchorPos);
        const el = node instanceof HTMLElement ? node : node.parentElement;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // pos may be invalid if document changed; ignore
      }
    }

    setPinnedBlockId(highlightBlockId);
  }, [highlightCommentId, highlightBlockId, editor]);

  useEffect(() => {
    return () => {
      cancelScheduledHideLiveCue();
    };
  }, [cancelScheduledHideLiveCue]);

  useEffect(() => {
    if (!ydoc) {
      return;
    }

    const onTransaction = ({
      transaction,
    }: {
      transaction: { doc: typeof editor.state.doc; docChanged: boolean };
    }) => {
      if (!transaction.docChanged) {
        return;
      }
      purgeOrphanedCommentThreads(ydoc, transaction.doc);
    };

    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, ydoc]);

  useEffect(() => {
    const view = editor.view;
    const root = view.dom;
    const commentedIds = commentedBlockIdSet;

    const pickCue = (clientX: number, clientY: number) => {
      if (!(editor.isEditable && !isAiBusy)) {
        return null;
      }

      const coords = view.posAtCoords({
        left: clientX,
        top: clientY,
      });
      if (coords?.pos === undefined) {
        return null;
      }

      const anchorInfo = getCommentAnchorFromPos(view, coords.pos);
      if (!anchorInfo?.rect) {
        return null;
      }

      if (
        anchorInfo.isEmpty &&
        !(anchorInfo.blockId && commentedIds.has(anchorInfo.blockId))
      ) {
        return null;
      }

      const bodyRect = root.getBoundingClientRect();

      if (!shouldShowTrailingCommentCue(clientX, clientY, anchorInfo.rect)) {
        return null;
      }

      return {
        anchorPos: anchorInfo.anchorPos,
        blockId: anchorInfo.blockId,
        iconLeftPx: bodyRect.right + COMMENT_MARGIN_GAP_PX,
        iconTopPx: anchorInfo.rect.top,
        editorRightPx: bodyRect.right,
      } satisfies CommentMarginCueGeom;
    };

    const onPointerMove = (e: PointerEvent) => {
      clearRaf();
      rafRef.current = requestAnimationFrame(() => {
        const cue = pickCue(e.clientX, e.clientY);
        const sig = buildSig(cue);
        if (sig !== sigRef.current) {
          sigRef.current = sig;
          setLiveCue(cue);
        }
        if (cue !== null) {
          cancelScheduledHideLiveCue();
        }
      });
    };

    const onPointerLeaveEditor = () => {
      clearRaf();
      scheduleHideLiveCue();
    };

    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeaveEditor);
    root.addEventListener("pointercancel", onPointerLeaveEditor);

    return () => {
      clearRaf();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeaveEditor);
      root.removeEventListener("pointercancel", onPointerLeaveEditor);
    };
  }, [
    cancelScheduledHideLiveCue,
    commentedBlockIdSet,
    editor,
    isAiBusy,
    scheduleHideLiveCue,
  ]);

  /** 滚动、视口缩放、编辑器布局变化后按 blockId 重算图标/面板位置 */
  useLayoutEffect(() => {
    if (!(displayGeom || commentedBlockIds.length > 0)) {
      return;
    }
    const view = editor.view;
    const root = view.dom;
    scheduleLayoutBump();

    const scrollParents: Element[] = [];
    let el: HTMLElement | null = root;
    while (el) {
      const { overflowX, overflowY } = window.getComputedStyle(el);
      if (
        /(auto|scroll|overlay)/.test(overflowX) ||
        /(auto|scroll|overlay)/.test(overflowY)
      ) {
        scrollParents.push(el);
      }
      el = el.parentElement;
    }

    window.addEventListener("scroll", scheduleLayoutBump, true);
    window.addEventListener("resize", scheduleLayoutBump);
    for (const p of scrollParents) {
      p.addEventListener("scroll", scheduleLayoutBump, { passive: true });
    }

    const ro = new ResizeObserver(() => {
      scheduleLayoutBump();
    });
    ro.observe(root);

    editor.on("transaction", scheduleLayoutBump);

    return () => {
      if (layoutBumpRafRef.current !== undefined) {
        cancelAnimationFrame(layoutBumpRafRef.current);
        layoutBumpRafRef.current = undefined;
      }
      window.removeEventListener("scroll", scheduleLayoutBump, true);
      window.removeEventListener("resize", scheduleLayoutBump);
      for (const p of scrollParents) {
        p.removeEventListener("scroll", scheduleLayoutBump);
      }
      ro.disconnect();
      editor.off("transaction", scheduleLayoutBump);
    };
  }, [
    commentedBlockIds.length,
    displayGeom,
    editor,
    scheduleLayoutBump,
  ]);

  useEffect(() => {
    if (!effectivePanelOpen) {
      return;
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleOpenChange(false);
      }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [effectivePanelOpen, handleOpenChange]);

  useEffect(() => {
    if (!effectivePanelOpen) {
      return;
    }

    const onOutside = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) {
        return;
      }
      const inAnchor =
        anchorRef.current !== null &&
        anchorRef.current.contains(targetNode);
      const inPanel =
        panelRef.current !== null &&
        panelRef.current.contains(targetNode);
      const inBridge =
        bridgeRef.current !== null &&
        bridgeRef.current.contains(targetNode);
      const inPersistent =
        persistentLayerRef.current !== null &&
        persistentLayerRef.current.contains(targetNode);
      if (inAnchor || inPanel || inBridge || inPersistent) {
        return;
      }
      handleOpenChange(false);
    };

    document.addEventListener("pointerdown", onOutside, true);
    return () => document.removeEventListener("pointerdown", onOutside, true);
  }, [effectivePanelOpen, handleOpenChange]);

  const handleFloatingUiPointerEnter = useCallback(() => {
    pointerOverFloatingUiRef.current = true;
    cancelScheduledHideLiveCue();
  }, [cancelScheduledHideLiveCue]);

  const handleFloatingUiPointerLeave = useCallback(() => {
    pointerOverFloatingUiRef.current = false;
    scheduleHideLiveCue();
  }, [scheduleHideLiveCue]);

  if (!mounted || !uiEnabled) {
    return null;
  }

  const BUTTON_SIZE_PX = 28;

  /** 桥接区只跟随当前 active 的图标，避免把无关持久图标一起圈进 hover 范围 */
  const bridgeGeom = activeAnchorGeom ?? hoverPreviewGeom;
  const bridgeLeft = bridgeGeom?.editorRightPx ?? 0;
  const bridgeRight =
    (bridgeGeom?.iconLeftPx ?? 0) + BRIDGE_EXTEND_RIGHT_PX;
  const bridgeWidth = Math.max(0, bridgeRight - bridgeLeft);
  const bridgeTop = (bridgeGeom?.iconTopPx ?? 0) - BRIDGE_PAD_Y_PX;
  const bridgeHeight = BUTTON_SIZE_PX + BRIDGE_PAD_Y_PX * 2;

  const panelTop =
    (activeAnchorGeom?.iconTopPx ?? 0) +
    BUTTON_SIZE_PX +
    PANEL_GAP_BELOW_BUTTON_PX;
  const panelLeft = clampPanelLeft(
    activeAnchorGeom?.iconLeftPx ?? 0,
    PANEL_WIDTH_PX
  );

  const showHoverButton =
    !effectivePanelOpen && hoverPreviewGeom !== null;

  /** ydoc 缺失时禁止落地评论，仅展示 hover 触发器，UI 仍可见以保证组件嵌入位置一致 */
  const canPersistComments = Boolean(ydoc);

  return createPortal(
    <>
      {bridgeGeom && (
        <div
          aria-hidden
          className="fixed z-30 bg-transparent"
          onPointerEnter={handleFloatingUiPointerEnter}
          onPointerLeave={handleFloatingUiPointerLeave}
          ref={bridgeRef}
          style={{
            height: `${bridgeHeight}px`,
            left: `${bridgeLeft}px`,
            top: `${bridgeTop}px`,
            width: `${bridgeWidth}px`,
          }}
        />
      )}

      {/* 已有评论的节点：始终常驻一个主题色图标，不依赖 hover */}
      <div ref={persistentLayerRef}>
        {persistentGeoms
          .filter(({ blockId }) => blockId !== activeBlockId)
          .map(({ blockId, geom }) => (
            <Button
              aria-haspopup="dialog"
              aria-label="查看本块评论"
              className="fixed z-40 size-7 bg-background/90 text-primary backdrop-blur-sm [&_svg]:size-4 [&_svg]:text-primary"
              key={blockId}
              onClick={() => {
                handlePersistentClick(blockId);
              }}
              onPointerEnter={handleFloatingUiPointerEnter}
              onPointerLeave={handleFloatingUiPointerLeave}
              size="icon"
              style={{
                left: `${geom.iconLeftPx}px`,
                top: `${geom.iconTopPx}px`,
              }}
              title="查看本块评论"
              type="button"
              variant="ghost"
            >
              <MessageSquareTextIcon aria-hidden className="text-primary" />
            </Button>
          ))}
      </div>

      {activeAnchorGeom && effectivePanelOpen && (
        <Button
          aria-expanded={effectivePanelOpen}
          aria-haspopup="dialog"
          aria-label={
            isActiveAnchorCommented
              ? "查看本块评论"
              : "评论当前块"
          }
          className={cn(
            "fixed z-40 size-7 bg-background/90 backdrop-blur-sm [&_svg]:size-4",
            isActiveAnchorCommented
              ? "text-primary opacity-100 [&_svg]:text-primary"
              : "text-muted-foreground opacity-100 [&_svg]:text-muted-foreground"
          )}
          onClick={handleAnchorClick}
          onPointerEnter={handleFloatingUiPointerEnter}
          onPointerLeave={handleFloatingUiPointerLeave}
          ref={anchorRef}
          size="icon"
          style={{
            left: `${activeAnchorGeom.iconLeftPx}px`,
            top: `${activeAnchorGeom.iconTopPx}px`,
          }}
          title={
            isActiveAnchorCommented
              ? "查看本块评论"
              : "在当前块发表评论"
          }
          type="button"
          variant="ghost"
        >
          <MessageSquareTextIcon aria-hidden />
        </Button>
      )}

      {showHoverButton && hoverPreviewGeom && (
        <Button
          aria-expanded={false}
          aria-haspopup="dialog"
          aria-label="评论当前块"
          className="fixed z-40 size-7 bg-background/90 text-muted-foreground opacity-70 backdrop-blur-sm hover:opacity-100 [&_svg]:size-4 [&_svg]:text-muted-foreground"
          onClick={handleAnchorClick}
          onPointerEnter={handleFloatingUiPointerEnter}
          onPointerLeave={handleFloatingUiPointerLeave}
          ref={anchorRef}
          size="icon"
          style={{
            left: `${hoverPreviewGeom.iconLeftPx}px`,
            top: `${hoverPreviewGeom.iconTopPx}px`,
          }}
          title="在当前块发表评论"
          type="button"
          variant="ghost"
        >
          <MessageSquareTextIcon aria-hidden />
        </Button>
      )}

      {effectivePanelOpen && activeAnchorGeom && canPersistComments && (
        <div
          aria-label="发表评论"
          className="fixed z-40 w-[min(20rem,calc(100vw-2rem))] outline-none"
          onPointerEnter={handleFloatingUiPointerEnter}
          onPointerLeave={handleFloatingUiPointerLeave}
          ref={panelRef}
          role="dialog"
          style={{
            left: `${panelLeft}px`,
            top: `${panelTop}px`,
          }}
          tabIndex={-1}
        >
          <CommentPrototypeForm
            comments={activeComments}
            onAddComment={handlePrototypeAdd}
            onDeleteComment={handlePrototypeDelete}
            documentId={documentId}
            mentionableUsers={mentionableUsers}
            highlightCommentId={highlightCommentId}
          />
        </div>
      )}
    </>,
    document.body
  );
}

export const CommentBlockMarginTrigger = memo(CommentBlockMarginTriggerInner);
