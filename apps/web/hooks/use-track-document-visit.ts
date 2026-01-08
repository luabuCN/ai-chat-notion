"use client";

import { useEffect, useRef } from "react";

interface UseTrackDocumentVisitProps {
  documentId: string;
  isPublished: boolean;
  isOwner: boolean;
}

/**
 * 追踪用户访问公开文档的 Hook
 * 当用户访问一个已发布的、非自己拥有的文档时，记录访问
 */
export function useTrackDocumentVisit({
  documentId,
  isPublished,
  isOwner,
}: UseTrackDocumentVisitProps) {
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // 只追踪已发布的、非自己的文档
    if (!documentId || !isPublished || isOwner || hasTrackedRef.current) {
      return;
    }

    hasTrackedRef.current = true;

    // 记录访问（异步，不阻塞页面加载）
    fetch(`/api/editor-documents/${documentId}/visit`, {
      method: "POST",
    }).catch((error) => {
      console.error("[Track Visit] Failed to record visit:", error);
    });
  }, [documentId, isPublished, isOwner]);
}
