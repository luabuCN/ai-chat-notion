import { useEffect, useState } from "react";
import {
  webFetchJsonErrorBody,
  webFetchWithMainSiteCookies,
} from "@/lib/web-fetch";
import { WEB_ORIGIN } from "@/lib/web-config";

/** 与主站 `app/api/models/route` 中 `ModelInfo` 对齐（扩展内独立类型，避免跨包引用）。 */
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
        const res = await webFetchWithMainSiteCookies(
          `${WEB_ORIGIN}/api/models`,
        );
        if (!res.ok) {
          const j = await webFetchJsonErrorBody(res);
          throw new Error(j.message ?? j.cause ?? res.statusText);
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
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, loading, error };
}
