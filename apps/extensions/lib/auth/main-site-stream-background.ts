import { MAIN_SITE_STREAM_PORT } from "@/lib/auth/stream-main-site";
import { WEB_ORIGIN } from "@/lib/web-config";

const ALLOWED_STREAM_PATH_PREFIX = "/api/ai/openai";

function buildMainSiteUrl(path: string): string {
  const base = WEB_ORIGIN.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function registerMainSiteStreamPort(): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== MAIN_SITE_STREAM_PORT) {
      return;
    }
    const controller = new AbortController();
    port.onDisconnect.addListener(() => {
      controller.abort();
    });
    const onFirst = (msg: unknown) => {
      port.onMessage.removeListener(onFirst);
      void handleMainSiteStream(port, msg, controller);
    };
    port.onMessage.addListener(onFirst);
  });
}

async function handleMainSiteStream(
  port: { postMessage: (message: unknown) => void },
  msg: unknown,
  controller: AbortController,
): Promise<void> {
  if (typeof msg !== "object" || msg === null) {
    port.postMessage({ type: "error", error: "Invalid payload" });
    return;
  }
  const m = msg as { path?: string; body?: string };
  if (typeof m.path !== "string" || typeof m.body !== "string") {
    port.postMessage({ type: "error", error: "Invalid payload" });
    return;
  }
  if (!m.path.startsWith(ALLOWED_STREAM_PATH_PREFIX)) {
    port.postMessage({ type: "error", error: "path not allowed" });
    return;
  }
  const url = buildMainSiteUrl(m.path);
  try {
    const res = await fetch(url, {
      method: "POST",
      body: m.body,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      let errText = res.statusText;
      try {
        const j = (await res.json()) as { error?: string };
        if (typeof j.error === "string") {
          errText = j.error;
        }
      } catch {
        // ignore
      }
      port.postMessage({ type: "error", error: errText });
      return;
    }
    if (!res.body) {
      port.postMessage({ type: "error", error: "empty body" });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value, { stream: true });
      if (text.length > 0) {
        port.postMessage({ type: "delta", delta: text });
      }
    }
    port.postMessage({ type: "done" });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return;
    }
    const message = e instanceof Error ? e.message : "fetch failed";
    port.postMessage({ type: "error", error: message });
  }
}
