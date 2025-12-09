"use client";

import { EditorPageHeader } from "./editor-page-header";
import { EditorClient } from "./editor-client";

interface EditorContentProps {
  locale: string;
}

export function EditorContent({ locale }: EditorContentProps) {
  return (
    <div className="min-h-full">
      <EditorPageHeader />

      <div className="max-w-4xl mx-auto px-4 pb-20">
        <EditorClient locale={locale} apiUrl="/api/blocknote-ai" />
      </div>
    </div>
  );
}
