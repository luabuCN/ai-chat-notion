"use client";

import { useParams } from "next/navigation";

/**
 * 获取当前 workspace 的 slug
 * 适用于 /[slug]/chat 和 /[slug]/documents 等路由下
 */
export function useWorkspaceSlug(): string {
  const params = useParams();
  const slug = params.slug;

  if (typeof slug === "string") {
    return slug;
  }

  // 如果 slug 是数组（catch-all routes），取第一个
  if (Array.isArray(slug) && slug.length > 0) {
    return slug[0];
  }

  // 默认返回空字符串，调用方应该处理这种情况
  return "";
}
