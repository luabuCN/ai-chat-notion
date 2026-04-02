import { fetchMainSiteApiJson } from "@/lib/main-site-api-fetch";

export type ExtensionWorkspace = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

function toErrorMessage(statusText: string, fallback: string): string {
  return statusText.trim() ? statusText : fallback;
}

export async function fetchExtensionWorkspaces(): Promise<ExtensionWorkspace[]> {
  const result = await fetchMainSiteApiJson("/api/workspaces", "GET");
  if (result.status === 0) {
    throw new Error(
      "无法连接主站，请确认主站已启动且扩展已登录，或稍后重试。",
    );
  }
  if (!result.ok) {
    throw new Error(toErrorMessage(result.statusText, "获取空间列表失败"));
  }
  const data = result.json;
  if (!Array.isArray(data)) {
    return [];
  }
  return data as ExtensionWorkspace[];
}
