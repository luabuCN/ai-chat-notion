export const MAIN_SITE_STREAM_PORT = "WiseWrite:MAIN_SITE_TEXT_STREAM";

/**
 * 由 background 对主站发起流式 POST，经 port 将 UTF-8 增量回传（content script 无可靠跨域 Cookie 流式读取）。
 */
export function streamMainSitePost(
  path: string,
  body: string,
  onDelta: (delta: string) => void,
): {
  done: Promise<{ ok: boolean; error?: string }>;
  disconnect: () => void;
} {
  const port = browser.runtime.connect({ name: MAIN_SITE_STREAM_PORT });
  let settled = false;
  let resolveDone!: (v: { ok: boolean; error?: string }) => void;
  const done = new Promise<{ ok: boolean; error?: string }>((resolve) => {
    resolveDone = resolve;
  });

  const finish = (result: { ok: boolean; error?: string }) => {
    if (settled) {
      return;
    }
    settled = true;
    try {
      port.onMessage.removeListener(onMessage);
    } catch {
      // ignore
    }
    try {
      port.disconnect();
    } catch {
      // ignore
    }
    resolveDone(result);
  };

  const onMessage = (msg: unknown) => {
    if (typeof msg !== "object" || msg === null) {
      return;
    }
    const m = msg as { type?: string; delta?: string; error?: string };
    if (m.type === "delta" && typeof m.delta === "string") {
      onDelta(m.delta);
      return;
    }
    if (m.type === "done") {
      finish({ ok: true });
      return;
    }
    if (m.type === "error") {
      finish({ ok: false, error: m.error ?? "请求失败" });
    }
  };

  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(() => {
    if (!settled) {
      finish({ ok: true });
    }
  });
  port.postMessage({ path, body });
  return {
    done,
    disconnect: () => {
      if (!settled) {
        port.disconnect();
      }
    },
  };
}
