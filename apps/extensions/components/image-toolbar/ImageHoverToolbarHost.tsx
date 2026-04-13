import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthStatus, openMainSiteLogin } from "@/lib/auth/client";
import { imageElementToDataUrl } from "@/lib/image-element-to-data-url";
import { sendMessage } from "@/lib/messaging/extension-messaging";
import { recognizeImageDataUrl } from "@/lib/run-tesseract-ocr";
import { ImageExtractTextPopover } from "./ImageExtractTextPopover";
import { ImageHoverToolbar } from "./ImageHoverToolbar";

const MIN_IMAGE_EDGE_PX = 32;
const SCAN_DEBOUNCE_MS = 120;
const TOOLBAR_SELECTOR = "[data-wisewrite-image-toolbar]";
const OCR_POPOVER_SELECTOR = "[data-wisewrite-ocr-popover]";

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

type OcrState = {
  error: string | null;
  imageId: string;
  phase: "loading" | "done";
  text: string;
};

export function ImageHoverToolbarHost() {
  const imgToIdRef = useRef(new WeakMap<HTMLImageElement, string>());
  const idToImgRef = useRef(new Map<string, HTMLImageElement>());
  const debounceRef = useRef<number | undefined>(undefined);

  const [entries, setEntries] = useState<{ id: string; rect: DOMRect }[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchorId, setMenuAnchorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrState | null>(null);

  const lastHoveredIdRef = useRef<string | null>(null);
  const clearHoverTimerRef = useRef<number | undefined>(undefined);
  const menuOpenRef = useRef(false);
  const ocrPopupOpenRef = useRef(false);

  useEffect(() => {
    menuOpenRef.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    ocrPopupOpenRef.current = ocr !== null;
  }, [ocr]);

  const scanImages = useCallback(() => {
    const wm = imgToIdRef.current;
    const idToImg = new Map<string, HTMLImageElement>();
    const next: { id: string; rect: DOMRect }[] = [];
    for (const node of document.querySelectorAll("img")) {
      if (!(node instanceof HTMLImageElement)) {
        continue;
      }
      if (!node.isConnected) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      if (rect.width < MIN_IMAGE_EDGE_PX || rect.height < MIN_IMAGE_EDGE_PX) {
        continue;
      }
      let id = wm.get(node);
      if (!id) {
        id = crypto.randomUUID();
        wm.set(node, id);
      }
      idToImg.set(id, node);
      next.push({ id, rect });
    }
    idToImgRef.current = idToImg;
    setEntries(next);
  }, []);

  const scheduleScan = useCallback(() => {
    if (debounceRef.current !== undefined) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = undefined;
      scanImages();
    }, SCAN_DEBOUNCE_MS);
  }, [scanImages]);

  useEffect(() => {
    scanImages();
    window.addEventListener("scroll", scheduleScan, true);
    window.addEventListener("resize", scheduleScan);
    const mo = new MutationObserver(scheduleScan);
    mo.observe(document.documentElement, {
      attributeFilter: ["src", "srcset"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => {
      mo.disconnect();
      window.removeEventListener("scroll", scheduleScan, true);
      window.removeEventListener("resize", scheduleScan);
      if (debounceRef.current !== undefined) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [scanImages, scheduleScan]);

  useEffect(() => {
    const cancelHoverClear = () => {
      if (clearHoverTimerRef.current !== undefined) {
        window.clearTimeout(clearHoverTimerRef.current);
        clearHoverTimerRef.current = undefined;
      }
    };

    const scheduleHoverClear = () => {
      if (menuOpenRef.current || ocrPopupOpenRef.current) {
        return;
      }
      cancelHoverClear();
      clearHoverTimerRef.current = window.setTimeout(() => {
        clearHoverTimerRef.current = undefined;
        if (menuOpenRef.current || ocrPopupOpenRef.current) {
          return;
        }
        setHoveredId(null);
      }, 180);
    };

    const onPointerMove = (e: PointerEvent) => {
      const idToImg = idToImgRef.current;
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of stack) {
        if (!(el instanceof Element)) {
          continue;
        }
        if (el.closest(OCR_POPOVER_SELECTOR)) {
          cancelHoverClear();
          if (lastHoveredIdRef.current !== null) {
            setHoveredId(lastHoveredIdRef.current);
          }
          return;
        }
        if (el.closest(TOOLBAR_SELECTOR)) {
          cancelHoverClear();
          if (lastHoveredIdRef.current !== null) {
            setHoveredId(lastHoveredIdRef.current);
          }
          return;
        }
        if (el instanceof HTMLImageElement) {
          const id = imgToIdRef.current.get(el);
          if (id !== undefined && idToImg.has(id)) {
            cancelHoverClear();
            lastHoveredIdRef.current = id;
            setHoveredId(id);
            return;
          }
        }
      }
      scheduleHoverClear();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      cancelHoverClear();
      document.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  const visibleId = menuOpen ? menuAnchorId : hoveredId;
  const showToolbar = visibleId !== null;

  const activeEntry =
    visibleId !== null ? entries.find((e) => e.id === visibleId) : undefined;
  const activeRect = activeEntry?.rect;

  const runWithImage = useCallback(
    async (mode: "chat" | "extract") => {
      const targetId =
        menuAnchorId ?? hoveredId ?? lastHoveredIdRef.current;
      if (targetId === null) {
        return;
      }
      const img = idToImgRef.current.get(targetId);
      if (!img) {
        setErrorMessage("找不到图片元素");
        return;
      }
      setErrorMessage(null);

      if (mode === "extract") {
        setMenuOpen(false);
        setMenuAnchorId(null);
        const imageId = targetId;
        setOcr({
          error: null,
          imageId,
          phase: "loading",
          text: "",
        });
        void (async () => {
          try {
            const data = await imageElementToDataUrl(img);
            if ("error" in data) {
              setOcr((prev) =>
                prev?.imageId === imageId
                  ? {
                      ...prev,
                      error: data.error,
                      phase: "done",
                      text: "",
                    }
                  : prev,
              );
              return;
            }
            const text = await recognizeImageDataUrl(data.dataUrl);
            setOcr((prev) =>
              prev?.imageId === imageId
                ? {
                    ...prev,
                    error: null,
                    phase: "done",
                    text,
                  }
                : prev,
            );
          } catch (e) {
            const msg =
              e instanceof Error ? e.message : "文字识别失败，请稍后重试";
            setOcr((prev) =>
              prev?.imageId === imageId
                ? {
                    ...prev,
                    error: msg,
                    phase: "done",
                    text: "",
                  }
                : prev,
            );
          }
        })();
        return;
      }

      if (!(await ensureMainSiteAuthenticated())) {
        return;
      }
      setBusy(true);
      try {
        const data = await imageElementToDataUrl(img);
        if ("error" in data) {
          setErrorMessage(data.error);
          return;
        }
        const r = await sendMessage("openSidePanelWithImageDataUrl", {
          dataUrl: data.dataUrl,
          mode: "chat",
        });
        if (!r.ok) {
          setErrorMessage(r.error);
          return;
        }
        setMenuOpen(false);
        setMenuAnchorId(null);
        setErrorMessage(null);
      } catch (e) {
        setErrorMessage(
          e instanceof Error ? e.message : "无法打开侧栏，请稍后重试",
        );
      } finally {
        setBusy(false);
      }
    },
    [hoveredId, menuAnchorId],
  );

  const ocrPopover =
    ocr !== null ? (
      <ImageExtractTextPopover
        error={ocr.error}
        onClose={() => {
          setOcr(null);
        }}
        phase={ocr.phase}
        text={ocr.text}
      />
    ) : null;

  if (!showToolbar || activeRect === undefined) {
    return ocrPopover;
  }

  return (
    <>
      {ocrPopover}
      <ImageHoverToolbar
        anchorRect={activeRect}
        busy={busy}
        errorMessage={errorMessage}
        menuOpen={menuOpen}
        onExtract={() => {
          void runWithImage("extract");
        }}
        onImageChat={() => {
          void runWithImage("chat");
        }}
        onOpenChange={(open) => {
          setMenuOpen(open);
          if (open) {
            setMenuAnchorId(hoveredId ?? lastHoveredIdRef.current);
          } else {
            setMenuAnchorId(null);
            setErrorMessage(null);
          }
        }}
      />
    </>
  );
}
