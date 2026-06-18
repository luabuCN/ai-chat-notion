"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CollaborationProvider } from "@/components/editor/collaboration-context";
import { EditorLoadingSkeleton } from "@/components/editor/editor-loading-skeleton";
import { WhiteboardContent } from "./whiteboard-content";
import { WhiteboardHeader } from "./whiteboard-header";
import { useGetDocument } from "@/hooks/use-document-query";
import { useWorkspace } from "@/components/workspace-provider";
import { useSidebar } from "@repo/ui";

interface WhiteboardPageClientProps {
  documentId: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
}

export function WhiteboardPageClient({
  documentId,
  userId,
  userName,
  userEmail,
  userAvatarUrl,
}: WhiteboardPageClientProps) {
  const { data: document, isPending, error } = useGetDocument(documentId);
  const { currentWorkspace } = useWorkspace();
  const router = useRouter();
  const params = useParams();
  const { state, isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  const slugParam = params.slug;
  let workspaceSlug = "";
  if (typeof slugParam === "string") {
    workspaceSlug = slugParam;
  } else if (Array.isArray(slugParam) && slugParam[0]) {
    workspaceSlug = slugParam[0];
  }
  workspaceSlug = workspaceSlug || currentWorkspace?.slug || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!document || isPending) {
      return;
    }
    if (document.kind === "document") {
      const path = workspaceSlug
        ? `/${workspaceSlug}/editor/${documentId}`
        : `/editor/${documentId}`;
      router.replace(path);
    }
  }, [document, documentId, isPending, router, workspaceSlug]);

  const headerLeft = !mounted
    ? undefined
    : isMobile
      ? "0"
      : state === "collapsed"
        ? "0"
        : "var(--sidebar-width)";

  if (isPending || !document) {
    return (
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        <EditorLoadingSkeleton className="min-h-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center text-muted-foreground">
        无法加载白板
      </div>
    );
  }

  return (
    <CollaborationProvider>
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        <div
          className="fixed top-0 right-0 z-50 bg-background transition-[left] duration-200 ease-linear left-0 md:left-[var(--sidebar-width)]"
          style={mounted ? { left: headerLeft } : undefined}
        >
          <WhiteboardHeader
            documentId={documentId}
            conversionLocked={false}
            currentUserId={userId}
            currentUserName={userName}
            currentUserEmail={userEmail}
            currentUserAvatarUrl={userAvatarUrl}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <WhiteboardContent
            documentId={documentId}
            userId={userId}
            userName={userName}
            userEmail={userEmail}
            userAvatarUrl={userAvatarUrl}
          />
        </div>
      </div>
    </CollaborationProvider>
  );
}
