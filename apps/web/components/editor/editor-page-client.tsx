"use client";

import { CollaborationProvider } from "./collaboration-context";
import { EditorHeaderWrapper } from "./editor-header-wrapper";
import { EditorContent } from "./editor-content";

interface EditorPageClientProps {
  locale: string;
  documentId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export function EditorPageClient({
  locale,
  documentId,
  userId,
  userName,
  userEmail,
}: EditorPageClientProps) {
  return (
    <CollaborationProvider>
      <div className="flex min-h-dvh min-w-0 flex-col bg-background overflow-x-hidden">
        <div className="sticky top-0 z-49 bg-background shrink-0">
          <EditorHeaderWrapper
            locale={locale}
            documentId={documentId}
            currentUserId={userId}
          />
        </div>
        <div className="flex-1">
          <EditorContent
            locale={locale}
            documentId={documentId}
            userId={userId}
            userName={userName}
            userEmail={userEmail}
          />
        </div>
      </div>
    </CollaborationProvider>
  );
}
