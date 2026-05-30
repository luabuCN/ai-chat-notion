import { useEffect, useState } from "react";
import { getApiToken, refreshApiToken } from "@/lib/auth/api-token";
import { API_ORIGIN } from "@/lib/web-config";

/** 与 apps/server `src/http/routes/models` 中 `ModelInfo` 对齐（扩展内独立类型，避免跨包引用）。 */
export type ExtensionModelInfo = {
  provider: string;
  model: string;
  full_slug: string;
  context_length: number;
  supports_image_in: boolean;
  supports_video_in: boolean;
  supports_reasoning: boolean;
};

export function useExtensionModels() {
  const [models, setModels] = useState<ExtensionModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let token = await getApiToken();
        if (!token) throw new Error("未登录");

        const doFetch = (t: string) =>
          fetch(`${API_ORIGIN}/api/models`, {
            headers: { Authorization: `Bearer ${t}` },
          });

        let res = await doFetch(token);
        if (res.status === 401) {
          token = await refreshApiToken();
          if (token) res = await doFetch(token);
        }
        if (!res.ok) {
          let msg = res.statusText;
          try {
            const j = (await res.json()) as { message?: string; cause?: string };
            msg = j.message ?? j.cause ?? msg;
          } catch { /* ignore */ }
          throw new Error(msg);
        }
        const data = (await res.json()) as ExtensionModelInfo[];
        if (!cancelled) {
          setModels(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "未知错误");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return { models, loading, error };
}
