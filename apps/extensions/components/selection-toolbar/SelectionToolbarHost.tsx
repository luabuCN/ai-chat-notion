import { useEffect, useState } from "react";
import { AiChatDialog } from "./AiChatDialog";
import { SelectionToolbar } from "./SelectionToolbar";

type Position = {
  left: number;
  top: number;
};

export function SelectionToolbarHost() {
  const [pos, setPos] = useState<Position | null>(null);
  const [aiDialog, setAiDialog] = useState<{ selectedText: string } | null>(null);

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

    const hide = () => setPos(null);

    document.addEventListener("mouseup", syncFromSelection);
    document.addEventListener("scroll", hide, true);

    return () => {
      document.removeEventListener("mouseup", syncFromSelection);
      document.removeEventListener("scroll", hide, true);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPos(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleAiClick = (selectedText: string) => {
    // 关闭 toolbar，打开 AI 对话窗
    setPos(null);
    setAiDialog({ selectedText });
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
          />
        </div>
      )}

      {aiDialog && (
        <AiChatDialog
          onClose={() => setAiDialog(null)}
          selectedText={aiDialog.selectedText}
        />
      )}
    </>
  );
}

