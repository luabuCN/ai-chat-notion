"use client";

import { useParams } from "next/navigation";
import { useWorkspace } from "@/components/workspace-provider";

/**
 * 优先使用 URL 中的 slug，避免 workspace 尚未加载时触发无 workspace 参数的 API 请求。
 */
export function useEffectiveWorkspaceSlug() {
  const params = useParams();
  const { currentWorkspace, workspaces } = useWorkspace();

  const urlSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
        ? params.slug[0]
        : "";

  return urlSlug || currentWorkspace?.slug || workspaces[0]?.slug || "";
}
