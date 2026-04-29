import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Editor } from "@tiptap/core";
import AIResultPanel from "./result-panel";
import ConfirmButtons from "./confirm-buttons";
import { useAIPanelStore } from "./ai-panel-store";
import scrollIntoView from "scroll-into-view-if-needed";
import { UserPrompt } from "./user-prompt";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/alert-dialog";

interface AIPanelProps {
  editor: Editor;
}

const PANEL_GAP = 10;
const PANEL_SIDE_INSET = 40;
const VIEWPORT_PADDING = 16;
const PANEL_MAX_WIDTH = 720;
const PANEL_MIN_WIDTH = 320;
const PANEL_MIN_HEIGHT = 120;

export default function AIPanel({ editor }: AIPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissConfirmRef = useRef<HTMLDivElement>(null);
  const positionFrameRef = useRef<number | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  const [dismissConfirmOpen, setDismissConfirmOpen] = useState(false);
  const isVisible = useAIPanelStore((state) => state.isVisible);
  const isThinking = useAIPanelStore((state) => state.isThinking);
  const isStreaming = useAIPanelStore((state) => state.isStreaming);
  const mode = useAIPanelStore((state) => state.mode);
  const setHasSelection = useAIPanelStore((state) => state.setHasSelection);
  const setMode = useAIPanelStore((state) => state.setMode);
  const result = useAIPanelStore((state) => state.result);
  const error = useAIPanelStore((state) => state.error);
  const setVisible = useAIPanelStore((state) => state.setVisible);
  const setEditor = useAIPanelStore((state) => state.setEditor);
  const reset = useAIPanelStore((state) => state.reset);
  const stopStream = useAIPanelStore((state) => state.stopStream);

  // Set editor on mount
  useEffect(() => {
    setEditor(editor);
  }, [editor, setEditor]);

  // Create portal container on mount
  useEffect(() => {
    const container = document.createElement("div");
    container.className = "ai-panel-portal";
    document.body.appendChild(container);
    setPortalContainer(container);

    return () => {
      document.body.removeChild(container);
    };
  }, []);

  const updatePanelPosition = useCallback(() => {
    if (!isVisible || !editor || !editor.view || !panelRef.current) return;
    if (editor.isDestroyed) return;

    const selection = editor.state.selection;
    const { from, to } = selection;

    const editorContainer =
      document.getElementById("EDITOR-CONTAINER") ||
      editor.view.dom.closest<HTMLElement>("[data-editor-container]") ||
      editor.view.dom.parentElement ||
      editor.view.dom;

    if (!editorContainer) return;

    const editorRect = editorContainer.getBoundingClientRect();
    const view = editor.view;
    let start: ReturnType<typeof view.coordsAtPos>;
    let end: ReturnType<typeof view.coordsAtPos>;

    try {
      start = view.coordsAtPos(from);
      end = view.coordsAtPos(to);
    } catch {
      return;
    }

    const panel = panelRef.current;
    const availableWidth = Math.max(
      PANEL_MIN_WIDTH,
      editorRect.width - PANEL_SIDE_INSET * 2
    );
    const panelWidth = Math.min(
      PANEL_MAX_WIDTH,
      availableWidth,
      window.innerWidth - VIEWPORT_PADDING * 2
    );
    const desiredLeft = editorRect.left + PANEL_SIDE_INSET;
    const maxLeft = window.innerWidth - panelWidth - VIEWPORT_PADDING;
    const left = Math.min(Math.max(desiredLeft, VIEWPORT_PADDING), maxLeft);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    panel.style.maxHeight = "";
    panel.style.overflowY = "visible";
    const panelHeight = panel.getBoundingClientRect().height;
    const spaceAbove = top - PANEL_GAP - VIEWPORT_PADDING;
    const spaceBelow =
      window.innerHeight - bottom - PANEL_GAP - VIEWPORT_PADDING;
    const shouldStickBelow = mode === "command" && (isThinking || isStreaming);
    const shouldPlaceBelow =
      shouldStickBelow || panelHeight <= spaceBelow || spaceBelow >= spaceAbove;
    const availableHeight = Math.max(
      PANEL_MIN_HEIGHT,
      shouldPlaceBelow ? spaceBelow : spaceAbove
    );
    const displayedHeight = Math.min(panelHeight, availableHeight);
    const panelTop = shouldStickBelow
      ? bottom + PANEL_GAP
      : shouldPlaceBelow
      ? Math.max(
          VIEWPORT_PADDING,
          Math.min(
            bottom + PANEL_GAP,
            window.innerHeight - VIEWPORT_PADDING - displayedHeight
          )
        )
      : Math.max(VIEWPORT_PADDING, top - displayedHeight - PANEL_GAP);

    panel.style.position = "fixed";
    panel.style.left = `${left}px`;
    panel.style.top = `${panelTop}px`;
    panel.style.width = `${panelWidth}px`;
    panel.style.maxHeight = `${availableHeight}px`;
    panel.style.overflowY = "auto";
  }, [editor, isThinking, isStreaming, isVisible, mode]);

  const schedulePanelPositionUpdate = useCallback(() => {
    if (positionFrameRef.current !== null) {
      cancelAnimationFrame(positionFrameRef.current);
    }

    positionFrameRef.current = requestAnimationFrame(() => {
      positionFrameRef.current = null;
      updatePanelPosition();
    });
  }, [updatePanelPosition]);

  // Update position when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      schedulePanelPositionUpdate();

      // command 模式时聚焦输入框
      if (mode === "command") {
        setTimeout(() => {
          const input = panelRef.current?.querySelector("input");
          if (input) {
            input.focus();
          }
        }, 50);
      }

      // Let the panel render first
      setTimeout(() => {
        const panel = panelRef.current;
        if (panel) {
          scrollIntoView(panel, {
            scrollMode: "if-needed",
            block: "nearest",
            behavior: "smooth",
          });
        }
      }, 0);
    }
  }, [isVisible, mode, schedulePanelPositionUpdate]);

  // Hide panel when clicking away（AI 生成中先确认，避免误触关闭）
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!isVisible) {
        return;
      }
      if (panelRef.current?.contains(target)) {
        return;
      }
      if (dismissConfirmRef.current?.contains(target)) {
        return;
      }
      if (isThinking || isStreaming) {
        setDismissConfirmOpen(true);
        return;
      }
      reset();
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isVisible, isThinking, isStreaming, reset]);

  const confirmCloseWhileBusy = useCallback(() => {
    stopStream();
    reset();
    setDismissConfirmOpen(false);
  }, [reset, stopStream]);

  useEffect(() => {
    if (!isVisible) {
      setDismissConfirmOpen(false);
    }
  }, [isVisible]);

  // Update panel position when editor or any scroll container moves
  useEffect(() => {
    if (!isVisible) return;

    window.addEventListener("resize", schedulePanelPositionUpdate);
    document.addEventListener("scroll", schedulePanelPositionUpdate, true);

    return () => {
      window.removeEventListener("resize", schedulePanelPositionUpdate);
      document.removeEventListener("scroll", schedulePanelPositionUpdate, true);
      if (positionFrameRef.current !== null) {
        cancelAnimationFrame(positionFrameRef.current);
        positionFrameRef.current = null;
      }
    };
  }, [isVisible, schedulePanelPositionUpdate]);

  useEffect(() => {
    if (isVisible) {
      schedulePanelPositionUpdate();
    }
  }, [isVisible, isThinking, isStreaming, result, schedulePanelPositionUpdate]);

  // Update hasSelection when selection changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handleUpdate = () => {
      const selection = editor.state.selection;
      setHasSelection(!selection.empty);
      if (isVisible) {
        schedulePanelPositionUpdate();
      }
    };

    editor.on("selectionUpdate", handleUpdate);
    return () => {
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, isVisible, schedulePanelPositionUpdate, setHasSelection]);

  // Listen to keyboard space key
  useEffect(() => {
    function fn(event: KeyboardEvent) {
      if (!editor?.view || editor.isDestroyed) return;
      // Not space or tab key
      if (event.key !== " " && event.code !== "Tab") return;
      const selection = editor.state.selection;
      if (!selection.empty) return; // selection is not empty
      const node = selection.$anchor.node();
      if (node?.isTextblock && node.textContent?.trim() === "") {
        let hasAtom = false;
        node.content.forEach((child) => {
          if (child.isAtom) hasAtom = true;
        });
        if (hasAtom) return;
        event.preventDefault();
        setMode("command");
        setHasSelection(false);
        setVisible(true);
      }
    }

    const editorDom = editor?.view?.dom;
    editorDom?.addEventListener("keydown", fn);

    return () => {
      if (editorDom && !editor?.isDestroyed) {
        editorDom.removeEventListener("keydown", fn);
      }
    };
  }, [editor, setMode, setVisible, setHasSelection]);

  if (!portalContainer) return null;

  return createPortal(
    <>
      <AlertDialog
        open={dismissConfirmOpen}
        onOpenChange={setDismissConfirmOpen}
      >
        <AlertDialogContent
          ref={dismissConfirmRef}
          overlayClassName="z-[100001]"
          className="z-[100001]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>正在 AI 回答</AlertDialogTitle>
            <AlertDialogDescription>
              当前仍在生成回答，确定要关闭 AI 面板并停止生成吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">取消</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={confirmCloseWhileBusy}>
              确定关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div
        ref={panelRef}
        className="ai-panel rounded-xl"
        style={{
          display: isVisible ? "block" : "none",
          zIndex: 100000,
          position: "fixed",
          visibility: isVisible ? "visible" : "hidden",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.2s ease-in-out",
          maxWidth: `${PANEL_MAX_WIDTH}px`,
          border: "none",
        }}
      >
      <AIResultPanel result={result} isStreaming={isStreaming} error={error} />
      {/* bubble 模式：显示加载状态（与输入框样式一致） */}
      {mode === "bubble" && (isThinking || isStreaming) && !result && (
        <div className="ai-panel-input flex w-full items-center rounded-xl border border-violet-200/70 bg-white/95 p-1 text-popover-foreground shadow-[0_18px_45px_rgba(124,58,237,0.16)] ring-1 ring-violet-100/80 backdrop-blur dark:border-violet-500/25 dark:bg-background/95 dark:ring-violet-500/15">
          <Loader2 className="mx-2.5 w-4 h-4 text-muted-foreground animate-spin" />
          <div className="flex-1 py-2 text-sm text-muted-foreground">
            {isThinking ? "AI is thinking..." : "AI is writing..."}
          </div>
        </div>
      )}
      {/* command 模式：显示输入框 */}
      {mode === "command" && <UserPrompt />}
      {!isStreaming && result && <ConfirmButtons />}
    </div>
    </>,
    portalContainer
  );
}
