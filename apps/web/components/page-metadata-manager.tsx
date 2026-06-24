"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  isEditorPagePath,
  resetFavicon,
  resetPageTitle,
} from "@/lib/page-metadata";

/**
 * 离开文档编辑页时恢复默认 favicon 与标题。
 * 文档页由 EditorHeaderWrapper 自行设置页面元数据。
 */
export function PageMetadataManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || isEditorPagePath(pathname)) {
      return;
    }

    resetFavicon();
    resetPageTitle();
  }, [pathname]);

  return null;
}
