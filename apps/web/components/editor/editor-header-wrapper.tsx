"use client";

import { useEffect, useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { EditorHeader } from "./editor-header";
import { useGetDocument, documentKeys } from "@/hooks/use-document-query";

interface EditorHeaderWrapperProps {
  locale: string;
  documentId: string;
}

export function EditorHeaderWrapper({
  locale,
  documentId,
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

  return (
    <EditorHeader
      locale={locale}
      documentTitle={document?.title}
      documentIcon={document?.icon ?? null}
      documentId={documentId}
      isPublished={document?.isPublished}
      isFavorite={document?.isFavorite}
      isSaving={isSaving}
      isSaved={isSaved}
    />
  );
}
