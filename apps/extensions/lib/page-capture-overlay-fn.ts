/**
 * 注入到网页隔离环境的可序列化函数：不得引用模块级符号（executeScript 会序列化函数体）。
 * 使用 chrome.runtime 发送裁剪结果。
 */

export type PageCaptureCropMessage =
  | {
      type: "pageCaptureCropResult";
      requestId: string;
      dataUrl: string;
    }
  | {
      type: "pageCaptureCropCancel";
      requestId: string;
    };

export function pageCaptureOverlayFn(
  dataUrl: string,
  requestId: string,
): void {
  const send = (msg: PageCaptureCropMessage) => {
    const runtime = (
      globalThis as {
        chrome?: { runtime: { sendMessage: (m: PageCaptureCropMessage) => void } };
      }
    ).chrome?.runtime;
    if (runtime) {
      runtime.sendMessage(msg);
    }
  };

  const cleanup = (
    root: HTMLDivElement,
    onKey: (e: KeyboardEvent) => void,
    cap: HTMLDivElement,
  ) => {
    document.removeEventListener("keydown", onKey, true);
    cap.removeEventListener("pointerdown", onPointerDown);
    cap.removeEventListener("pointermove", onPointerMove);
    cap.removeEventListener("pointerup", onPointerUp);
    cap.removeEventListener("pointercancel", onPointerUp);
    root.remove();
  };

  const root = document.createElement("div");
  root.setAttribute("data-omniside-page-capture", requestId);
  root.style.cssText =
    "position:fixed;inset:0;z-index:2147483647;margin:0;padding:0;box-sizing:border-box;font-family:system-ui,sans-serif;";

  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  img.style.cssText =
    "position:absolute;top:0;left:0;width:100vw;height:100vh;object-fit:fill;user-select:none;pointer-events:none;display:block;";

  const captureLayer = document.createElement("div");
  captureLayer.style.cssText =
    "position:absolute;inset:0;z-index:1;cursor:crosshair;touch-action:none;background:transparent;";

  const box = document.createElement("div");
  box.style.cssText =
    "position:absolute;z-index:2;display:none;box-sizing:border-box;border:2px dashed #3b82f6;background:transparent;box-shadow:0 0 0 9999px rgba(15,23,42,0.62);pointer-events:none;";

  const toolbar = document.createElement("div");
  toolbar.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:10px;padding:10px 14px;background:rgba(15,23,42,0.92);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.35);z-index:3;";

  const makeBtn = (label: string, primary: boolean) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = primary
      ? "padding:8px 16px;border-radius:8px;border:none;background:#3b82f6;color:#fff;font-size:14px;font-weight:600;cursor:pointer;"
      : "padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:#e2e8f0;font-size:14px;cursor:pointer;";
    return b;
  };

  const btnCancel = makeBtn("取消", false);
  const btnDownload = makeBtn("下载", false);
  btnDownload.title =
    "有选区时下载选中区域；无选区时下载当前可见区域整图";
  const btnOk = makeBtn("确认截取", true);

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  let startX = 0;
  let startY = 0;
  let curX = 0;
  let curY = 0;
  let dragging = false;
  let hasBox = false;

  const applyBox = () => {
    const x1 = startX;
    const y1 = startY;
    const x2 = curX;
    const y2 = curY;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    if (width < 2 || height < 2) {
      box.style.display = "none";
      hasBox = false;
      btnOk.style.opacity = "0.45";
      btnOk.style.cursor = "not-allowed";
      return;
    }
    hasBox = true;
    btnOk.style.opacity = "1";
    btnOk.style.cursor = "pointer";
    box.style.display = "block";
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    curX = startX;
    curY = startY;
    applyBox();
    captureLayer.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) {
      return;
    }
    curX = e.clientX;
    curY = e.clientY;
    applyBox();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) {
      return;
    }
    dragging = false;
    curX = e.clientX;
    curY = e.clientY;
    applyBox();
    try {
      captureLayer.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const cropToDataUrl = (): string | null => {
    if (!hasBox) {
      return null;
    }
    const rect = box.getBoundingClientRect();
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    if (iw <= 0 || ih <= 0 || cw <= 0 || ch <= 0) {
      return null;
    }
    const scaleX = iw / cw;
    const scaleY = ih / ch;
    const sx = Math.max(0, Math.floor(rect.left * scaleX));
    const sy = Math.max(0, Math.floor(rect.top * scaleY));
    const sw = Math.min(iw - sx, Math.ceil(rect.width * scaleX));
    const sh = Math.min(ih - sy, Math.ceil(rect.height * scaleY));
    if (sw < 1 || sh < 1) {
      return null;
    }
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/png");
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cleanup(root, onKey, captureLayer);
      send({ type: "pageCaptureCropCancel", requestId });
    }
  };

  btnCancel.addEventListener("click", () => {
    cleanup(root, onKey, captureLayer);
    send({ type: "pageCaptureCropCancel", requestId });
  });

  btnDownload.addEventListener("click", () => {
    const ts = Date.now();
    if (hasBox) {
      const cropped = cropToDataUrl();
      if (!cropped) {
        return;
      }
      triggerDownload(cropped, `omniside-crop-${ts}.png`);
      return;
    }
    triggerDownload(dataUrl, `omniside-full-${ts}.png`);
  });

  btnOk.addEventListener("click", () => {
    const cropped = cropToDataUrl();
    if (!cropped) {
      return;
    }
    cleanup(root, onKey, captureLayer);
    send({ type: "pageCaptureCropResult", requestId, dataUrl: cropped });
  });

  img.addEventListener("load", () => {
    document.body.appendChild(root);
  });

  img.addEventListener("error", () => {
    cleanup(root, onKey, captureLayer);
    send({ type: "pageCaptureCropCancel", requestId });
  });

  document.addEventListener("keydown", onKey, true);

  captureLayer.addEventListener("pointerdown", onPointerDown);
  captureLayer.addEventListener("pointermove", onPointerMove);
  captureLayer.addEventListener("pointerup", onPointerUp);
  captureLayer.addEventListener("pointercancel", onPointerUp);

  btnOk.style.opacity = "0.45";
  btnOk.style.cursor = "not-allowed";

  root.appendChild(img);
  root.appendChild(captureLayer);
  root.appendChild(box);
  root.appendChild(toolbar);
  toolbar.appendChild(btnCancel);
  toolbar.appendChild(btnDownload);
  toolbar.appendChild(btnOk);

  img.src = dataUrl;
}
