import type { Editor } from "@tiptap/core";
import { MessageSquareTextIcon } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@repo/ui/button";
import { cn } from "../../lib/utils";
import { useAIPanelStore } from "../ai-panel/ai-panel-store";
import type { CommentMarginCueGeom } from "./comment-margin-types";
import {
  COMMENT_MARGIN_GAP_PX,
  getCommentAnchorFromPos,
  shouldShowTrailingCommentCue,
} from "./comment-margin-utils";
import { CommentPrototypeForm } from "./comment-prototype-form";
import { useCommentSelectionHandoffStore } from "./comment-selection-handoff-store";

export type { CommentMarginCueGeom } from "./comment-margin-types";

const PANEL_WIDTH_PX = 320;
const PANEL_GAP_BELOW_BUTTON_PX = 6;
const HIDE_LIVE_CUE_DELAY_MS = 320;
const BRIDGE_EXTEND_RIGHT_PX = 36;
const BRIDGE_PAD_Y_PX = 14;

function buildSig(geom: CommentMarginCueGeom | null) {
  if (!geom) {
    return "";
  }
  return `${geom.anchorPos}|${geom.iconLeftPx.toFixed(0)}|${geom.iconTopPx.toFixed(
    0
  )}`;
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

function CommentBlockMarginTriggerInner({ editor }: { editor: Editor }) {
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

  const pointerGeom =
    open && !handoffGeom ? frozenCue ?? liveCue : liveCue;
  const displayGeom = handoffGeom ?? pointerGeom;

  const effectivePanelOpen = handoffGeom
    ? handoffPanelOpen
    : open;

  const rafRef = useRef<number | undefined>(undefined);
  const sigRef = useRef("");
  const liveCueRef = useRef<CommentMarginCueGeom | null>(null);
  liveCueRef.current = liveCue;

  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const bridgeRef = useRef<HTMLDivElement | null>(null);
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
      }
      return nextOpen;
    });
  }, [dismissHandoff]);

  useEffect(() => {
    openRef.current = effectivePanelOpen;
  }, [effectivePanelOpen]);

  const handleAnchorClick = useCallback(() => {
    if (handoffGeom !== null) {
      dismissHandoff();
      setOpen(false);
      setFrozenCue(null);
      return;
    }
    handleOpenToggle();
  }, [dismissHandoff, handleOpenToggle, handoffGeom]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      cancelScheduledHideLiveCue();
    };
  }, [cancelScheduledHideLiveCue]);

  useEffect(() => {
    const view = editor.view;
    const root = view.dom;

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

      const bodyRect = root.getBoundingClientRect();

      if (!shouldShowTrailingCommentCue(clientX, clientY, anchorInfo.rect)) {
        return null;
      }

      return {
        anchorPos: anchorInfo.anchorPos,
        iconLeftPx: bodyRect.right + COMMENT_MARGIN_GAP_PX,
        iconTopPx:
          anchorInfo.rect.top +
          anchorInfo.rect.height * 0.5 -
          12,
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
  }, [cancelScheduledHideLiveCue, editor, isAiBusy, scheduleHideLiveCue]);

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
      if (inAnchor || inPanel || inBridge) {
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

  if (!mounted) {
    return null;
  }

  if (!displayGeom) {
    return null;
  }

  const BUTTON_SIZE_PX = 28;
  const bridgeLeft = displayGeom.editorRightPx;
  const bridgeRight = displayGeom.iconLeftPx + BRIDGE_EXTEND_RIGHT_PX;
  const bridgeWidth = Math.max(0, bridgeRight - bridgeLeft);
  const bridgeTop = displayGeom.iconTopPx - BRIDGE_PAD_Y_PX;
  const bridgeHeight = BUTTON_SIZE_PX + BRIDGE_PAD_Y_PX * 2;

  const panelTop =
    displayGeom.iconTopPx +
    BUTTON_SIZE_PX +
    PANEL_GAP_BELOW_BUTTON_PX;
  const panelLeft = clampPanelLeft(displayGeom.iconLeftPx, PANEL_WIDTH_PX);

  return createPortal(
    <>
      <div
        ref={bridgeRef}
        aria-hidden
        className="fixed z-[120] bg-transparent"
        style={{
          left: `${bridgeLeft}px`,
          top: `${bridgeTop}px`,
          width: `${bridgeWidth}px`,
          height: `${bridgeHeight}px`,
        }}
        onPointerEnter={handleFloatingUiPointerEnter}
        onPointerLeave={handleFloatingUiPointerLeave}
      />
      <Button
        ref={anchorRef}
        type="button"
        variant="ghost"
        size="icon"
        title="在当前块发表评论（原型）"
        className={cn(
          "fixed size-7 bg-background/90 backdrop-blur-sm [&_svg]:size-4",
          effectivePanelOpen
            ? "z-[131] opacity-100"
            : "z-[131] opacity-70 hover:opacity-100"
        )}
        aria-label="评论当前块（原型占位）"
        aria-expanded={effectivePanelOpen}
        aria-haspopup="dialog"
        style={{
          top: `${displayGeom.iconTopPx}px`,
          left: `${displayGeom.iconLeftPx}px`,
        }}
        onClick={handleAnchorClick}
        onPointerEnter={handleFloatingUiPointerEnter}
        onPointerLeave={handleFloatingUiPointerLeave}
      >
        <MessageSquareTextIcon className="text-muted-foreground" aria-hidden />
      </Button>
      {effectivePanelOpen && (
        <div
          ref={panelRef}
          className="fixed z-[132] w-[min(20rem,calc(100vw-2rem))] outline-none"
          style={{
            top: `${panelTop}px`,
            left: `${panelLeft}px`,
          }}
          role="dialog"
          aria-label="发表评论"
          tabIndex={-1}
          onPointerEnter={handleFloatingUiPointerEnter}
          onPointerLeave={handleFloatingUiPointerLeave}
        >
          <CommentPrototypeForm />
        </div>
      )}
    </>,
    document.body
  );
}

export const CommentBlockMarginTrigger = memo(CommentBlockMarginTriggerInner);
