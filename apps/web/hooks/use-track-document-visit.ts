"use client";

import { useEffect, useRef } from "react";

interface UseTrackDocumentVisitProps {
  documentId: string;
  /** 文档是否公开可访问（只读发布或公开协作都算） */
  isPublic: boolean;
  isOwner: boolean;
}

/**
 * 追踪用户访问公开文档的 Hook
 * 当用户访问一个公开可访问的、非自己拥有的文档时，记录访问
 */
export function useTrackDocumentVisit({
  documentId,
  isPublic,
  isOwner,
}: UseTrackDocumentVisitProps) {
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (!documentId || !isPublic || isOwner || hasTrackedRef.current) {
      return;
    }

    hasTrackedRef.current = true;

    fetch(`/api/editor-documents/${documentId}/visit`, {
      method: "POST",
    }).catch((error) => {
      console.error("[Track Visit] Failed to record visit:", error);
    });
  }, [documentId, isPublic, isOwner]);
}
