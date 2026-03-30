import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Editor } from "@tiptap/core";
import AIResultPanel from "./result-panel";
import ConfirmButtons from "./confirm-buttons";
import { useAIPanelStore } from "./ai-panel-store";
import scrollIntoView from "scroll-into-view-if-needed";
import { UserPrompt } from "./user-prompt";
import { Loader2 } from "lucide-react";

interface AIPanelProps {
  editor: Editor;
}

export default function AIPanel({ editor }: AIPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null
  );
  const isVisible = useAIPanelStore((state) => state.isVisible);
  const isThinking = useAIPanelStore((state) => state.isThinking);
  const isStreaming = useAIPanelStore((state) => state.isStreaming);
  const mode = useAIPanelStore((state) => state.mode);
  const setHasSelection = useAIPanelStore((state) => state.setHasSelection);
  const result = useAIPanelStore((state) => state.result);
  const error = useAIPanelStore((state) => state.error);
  const setVisible = useAIPanelStore((state) => state.setVisible);
  const setEditor = useAIPanelStore((state) => state.setEditor);
  const reset = useAIPanelStore((state) => state.reset);

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

  function updatePanelPosition() {
    if (!editor || !editor.view || !panelRef.current) return;

    const selection = editor.state.selection;
    const { from, to } = selection;

    // Use a generic container ID or try to find the editor root
    let editorContainer = document.getElementById("EDITOR-CONTAINER");
    if (!editorContainer) {
      // Fallback to finding by class if ID is not present
      editorContainer = editor.view.dom.parentElement;
    }
    if (!editorContainer) return;

    const editorRect = editorContainer.getBoundingClientRect();
    const view = editor.view;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const bottom = Math.max(start.bottom, end.bottom);

    // Set panel position
    const panel = panelRef.current;
    const left = editorRect.left;
    const top = bottom + window.scrollY + 10;

    panel.style.position = "absolute";
    panel.style.left = `${left + 40}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${editorRect.width - 80}px`;
  }

  // Update position when panel becomes visible
  useEffect(() => {
    if (isVisible) {
      updatePanelPosition();

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
  }, [isVisible, mode]);

  // Hide panel when clicking away
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        // If clicking outside and not selecting text in editor
        if (isVisible) {
          reset();
        }
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isVisible, reset]);

  // Update panel position when editor changes
  useEffect(() => {
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition);
    };
  }, [editor, isVisible]);

  // Update hasSelection when selection changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const handleUpdate = () => {
      const selection = editor.state.selection;
      setHasSelection(!selection.empty);
    };

    editor.on("selectionUpdate", handleUpdate);
    return () => {
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, setHasSelection]);

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
  }, [editor, setVisible, setHasSelection]);

  if (!portalContainer) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="ai-panel dark:bg-background rounded-md p-2"
      style={{
        display: isVisible ? "block" : "none",
        zIndex: 50,
        position: "absolute",
        visibility: isVisible ? "visible" : "hidden",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.2s ease-in-out",
        maxWidth: "800px",
        border: "none",
      }}
    >
      <AIResultPanel result={result} error={error} />
      {/* bubble 模式：显示加载状态（与输入框样式一致） */}
      {mode === "bubble" && (isThinking || isStreaming) && !result && (
        <div className="ai-panel-input flex items-center w-full rounded-md border bg-popover dark:bg-popover p-0.5 text-popover-foreground">
          <Loader2 className="mx-2.5 w-4 h-4 text-muted-foreground animate-spin" />
          <div className="flex-1 py-2 text-sm text-muted-foreground">
            {isThinking ? "AI is thinking..." : "AI is writing..."}
          </div>
        </div>
      )}
      {/* command 模式：显示输入框 */}
      {mode === "command" && <UserPrompt />}
      {!isStreaming && result && <ConfirmButtons />}
    </div>,
    portalContainer
  );
}
