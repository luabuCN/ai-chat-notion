"use client";

import { EditorPageHeader } from "./editor-page-header";
import { EditorClient } from "./editor-client";

interface EditorContentProps {
  locale: string;
}

export function EditorContent({ locale }: EditorContentProps) {
  const onChange = (value: string) => {
    console.log("Editor content changed:", value);
  };

  return (
    <div className="min-h-full">
      <EditorPageHeader />

      <div className="max-w-4xl mx-auto px-4 pb-20">
        <EditorClient
          locale={locale}
          apiUrl="/api/blocknote-ai"
          onChange={onChange}
        />
      </div>
    </div>
  );
}
