import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { getAuthStatus, openMainSiteLogin } from "@/lib/auth/client";
import {
  type HighlightColor,
  getHighlightInfo,
  highlightSelection,
} from "@/lib/highlight-manager";
import { restoreAllHighlightsForCurrentPage, saveHighlightFromDom } from "@/lib/highlight-persistence";
import { useExtensionPortalContainer } from "@/lib/extension-portal-context";
import { AiChatDialog } from "./AiChatDialog";
import { HighlightPopover } from "./HighlightPopover";
import { SelectionToolbar } from "./SelectionToolbar";

/** 与 streamdown 解耦，避免整包打进 content 主入口（曾导致 ~50MB+ 与注入失败） */
const AiChatResultDialog = lazy(async () => {
  const m = await import("./AiChatResultDialog");
  return { default: m.AiChatResultDialog };
});

const TranslateResultDialog = lazy(async () => {
  const m = await import("./TranslateResultDialog");
  return { default: m.TranslateResultDialog };
});

/** 解释入口传给接口的 userQuery，与 AI 问答流一致，仅跳过输入弹窗 */
const EXPLAIN_USER_QUERY = "解释";

/** 与 AI 助手相同的登录校验，通过返回 true */
async function ensureMainSiteAuthenticated(): Promise<boolean> {
  try {
    const status = await getAuthStatus();
    if (status.authenticated !== true) {
      await openMainSiteLogin();
      return false;
    }
  } catch {
    await openMainSiteLogin();
    return false;
  }
  return true;
}

type Position = {
  left: number;
  top: number;
};

type AiDialogState =
  | { step: "input"; selectedText: string }
  | {
      step: "result";
      selectedText: string;
      query: string;
      /** 从「解释」直达结果页时为 true，此时返回应整体关闭，不打开输入弹窗 */
      fromExplain?: boolean;
    };

type HighlightPopoverState = {
  id: string;
  color: HighlightColor;
  position: Position;
};

type TranslateDialogState = {
  selectedText: string;
  languageId: string;
};

export function SelectionToolbarHost() {
  const extensionPortalHost = useExtensionPortalContainer();
  const [pos, setPos] = useState<Position | null>(null);
  const [aiDialog, setAiDialog] = useState<AiDialogState | null>(null);
  const [translateDialog, setTranslateDialog] =
    useState<TranslateDialogState | null>(null);
  const [hlPopover, setHlPopover] = useState<HighlightPopoverState | null>(null);

  /** 页面加载后从 IndexedDB 恢复当前页已保存的高亮 */
  useEffect(() => {
    void restoreAllHighlightsForCurrentPage();
  }, []);

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
    const id = highlightSelection("yellow");
    if (id) void saveHighlightFromDom(id);
    setPos(null);
  }, []);

  const handleAiClick = async (selectedText: string) => {
    setPos(null);
    if (!(await ensureMainSiteAuthenticated())) return;
    setAiDialog({ step: "input", selectedText });
  };

  const handleExplainClick = async (selectedText: string) => {
    setPos(null);
    if (!(await ensureMainSiteAuthenticated())) return;
    setAiDialog({
      step: "result",
      selectedText,
      query: EXPLAIN_USER_QUERY,
      fromExplain: true,
    });
  };

  const handleTranslateLanguage = async (
    selectedText: string,
    languageId: string,
  ) => {
    if (!selectedText.trim()) {
      return;
    }
    setPos(null);
    if (!(await ensureMainSiteAuthenticated())) return;
    setTranslateDialog({ selectedText, languageId });
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
            onExplainClick={handleExplainClick}
            onHighlight={handleHighlight}
            onTranslateLanguage={handleTranslateLanguage}
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
            onBack={() => {
              if (aiDialog.fromExplain === true) {
                setAiDialog(null);
                return;
              }
              setAiDialog({ step: "input", selectedText: aiDialog.selectedText });
            }}
            onClose={() => setAiDialog(null)}
            selectedText={aiDialog.selectedText}
            userQuery={aiDialog.query}
          />
        </Suspense>
      )}

      {translateDialog !== null && (
        <Suspense fallback={null}>
          <TranslateResultDialog
            initialLanguageId={translateDialog.languageId}
            onClose={() => setTranslateDialog(null)}
            extensionPortalHost={extensionPortalHost}
            selectedText={translateDialog.selectedText}
          />
        </Suspense>
      )}
    </>
  );
}

