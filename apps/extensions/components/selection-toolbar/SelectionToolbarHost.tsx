import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { getAuthStatus, openMainSiteLogin } from "@/lib/auth/client";
import {
  type HighlightColor,
  getHighlightInfo,
  highlightSelection,
} from "@/lib/highlight-manager";
import { AiChatDialog } from "./AiChatDialog";
import { HighlightPopover } from "./HighlightPopover";
import { SelectionToolbar } from "./SelectionToolbar";

/** 与 streamdown 解耦，避免整包打进 content 主入口（曾导致 ~50MB+ 与注入失败） */
const AiChatResultDialog = lazy(async () => {
  const m = await import("./AiChatResultDialog");
  return { default: m.AiChatResultDialog };
});

type Position = {
  left: number;
  top: number;
};

type AiDialogState =
  | { step: "input"; selectedText: string }
  | { step: "result"; selectedText: string; query: string };

type HighlightPopoverState = {
  id: string;
  color: HighlightColor;
  position: Position;
};

export function SelectionToolbarHost() {
  const [pos, setPos] = useState<Position | null>(null);
  const [aiDialog, setAiDialog] = useState<AiDialogState | null>(null);
  const [hlPopover, setHlPopover] = useState<HighlightPopoverState | null>(null);

  useEffect(() => {
    const syncFromSelection = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || !sel || sel.rangeCount === 0) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      setPos({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 8,
      });
    };

    const hide = () => {
      setPos(null);
      setHlPopover(null);
    };

    document.addEventListener("mouseup", syncFromSelection);
    document.addEventListener("scroll", hide, true);

    return () => {
      document.removeEventListener("mouseup", syncFromSelection);
      document.removeEventListener("scroll", hide, true);
    };
  }, []);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const info = getHighlightInfo(e.target);
      if (info) {
        const rect = info.element.getBoundingClientRect();
        setHlPopover({
          id: info.id,
          color: info.color,
          position: { left: rect.left + rect.width / 2, top: rect.bottom + 8 },
        });
        return;
      }
      const inShadow = e.composedPath().some((el) => el instanceof ShadowRoot);
      if (!inShadow) setHlPopover(null);
    };
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPos(null);
        setHlPopover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleHighlight = useCallback(() => {
    highlightSelection("yellow");
    setPos(null);
  }, []);

  const handleAiClick = async (selectedText: string) => {
    setPos(null);
    try {
      const status = await getAuthStatus();
      if (status.authenticated !== true) {
        await openMainSiteLogin();
        return;
      }
    } catch {
      await openMainSiteLogin();
      return;
    }
    setAiDialog({ step: "input", selectedText });
  };

  return (
    <>
      {pos && (
        <div
          className="pointer-events-auto"
          style={{
            position: "fixed",
            left: pos.left,
            top: pos.top,
            transform: "translateX(-50%)",
            zIndex: 2_147_483_647,
          }}
        >
          <SelectionToolbar
            onAiClick={handleAiClick}
            onClose={() => setPos(null)}
            onHighlight={handleHighlight}
          />
        </div>
      )}

      {hlPopover && (
        <HighlightPopover
          currentColor={hlPopover.color}
          highlightId={hlPopover.id}
          onClose={() => setHlPopover(null)}
          position={hlPopover.position}
        />
      )}

      {aiDialog?.step === "input" && (
        <AiChatDialog
          onClose={() => setAiDialog(null)}
          onSubmitQuery={(query) => {
            setAiDialog((prev) => {
              if (!prev || prev.step !== "input") return prev;
              return {
                step: "result",
                query,
                selectedText: prev.selectedText,
              };
            });
          }}
          selectedText={aiDialog.selectedText}
        />
      )}

      {aiDialog?.step === "result" && (
        <Suspense fallback={null}>
          <AiChatResultDialog
            onBack={() =>
              setAiDialog({ step: "input", selectedText: aiDialog.selectedText })
            }
            onClose={() => setAiDialog(null)}
            selectedText={aiDialog.selectedText}
            userQuery={aiDialog.query}
          />
        </Suspense>
      )}
    </>
  );
}

