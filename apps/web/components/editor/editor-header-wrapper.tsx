"use client";

import { useEffect, useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { EditorHeader } from "./editor-header";
import { TrashBanner } from "./trash-banner";
import { useGetDocument, documentKeys } from "@/hooks/use-document-query";

interface EditorHeaderWrapperProps {
  locale: string;
  documentId: string;
  currentUserId?: string;
}

export function EditorHeaderWrapper({
  locale,
  documentId,
  currentUserId,
}: EditorHeaderWrapperProps) {
  const { data: document } = useGetDocument(documentId);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const mutations = useMutationState({
    filters: { mutationKey: documentKeys.updates() },
    select: (mutation: any) => mutation.state,
  });

  const latestMutation = mutations
    .filter((m) => (m.variables as any)?.documentId === documentId)
    .pop();

  const isSaving = latestMutation?.status === "pending";
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (latestMutation?.status === "success") {
      setIsSaved(true);
      const timer = setTimeout(() => setIsSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [latestMutation?.submittedAt, latestMutation?.status]);

  if (document?.deletedAt) {
    return (
      <div className="flex flex-col">
        <TrashBanner documentId={documentId} />
      </div>
    );
  }

  // 只读模式：accessLevel 为 view 时隐藏编辑按钮
  const isReadOnly = (document as any)?.accessLevel === "view";
  const isOwner = (document as any)?.accessLevel === "owner";

  return (
    <EditorHeader
      locale={locale}
      documentTitle={document?.title}
      documentIcon={document?.icon ?? null}
      documentId={documentId}
      workspaceId={document?.workspaceId ?? null}
      isPublished={document?.isPublished}
      isFavorite={document?.isFavorite}
      isSaving={isSaving}
      isSaved={isSaved}
      readonly={isReadOnly}
      isOwner={isOwner}
      currentUserId={currentUserId}
      documentOwnerId={document?.userId}
    />
  );
}
