"use client";

import { useEffect, useState } from "react";
import { EditorHeader } from "./editor-header";
import { useGetDocument } from "@/hooks/use-document-query";

interface EditorHeaderWrapperProps {
  locale: string;
  documentId: string;
}

export function EditorHeaderWrapper({
  locale,
  documentId,
}: EditorHeaderWrapperProps) {
  const { data: document } = useGetDocument(documentId);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // 监听保存状态
  useEffect(() => {
    const handleSaving = () => setIsSaving(true);
    const handleSaved = () => {
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    };

    window.addEventListener("document-saving", handleSaving);
    window.addEventListener("document-saved", handleSaved);
    return () => {
      window.removeEventListener("document-saving", handleSaving);
      window.removeEventListener("document-saved", handleSaved);
    };
  }, []);

  return (
    <EditorHeader
      locale={locale}
      documentTitle={document?.title}
      documentIcon={document?.icon ?? null}
      isSaving={isSaving}
      isSaved={isSaved}
    />
  );
}

