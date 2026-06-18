"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
  useSidebar,
} from "@repo/ui";
import { Loader2, CheckCircle2, Star, Wifi, WifiOff, PenTool } from "lucide-react";
import { generateUserColor } from "@repo/editor";
import type { CollaborativeUser } from "@repo/editor";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { EmojiPicker } from "@/components/editor/emoji-picker";
import { PublishPopover } from "@/components/editor/publish-popover";
import { DocumentSharePopover } from "@/components/editor/document-share-popover";
import { useCollaboration } from "@/components/editor/collaboration-context";
import { useGetDocument, useUpdateDocument } from "@/hooks/use-document-query";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { setPageTitle, setFavicon, getFaviconUrl } from "@/lib/page-metadata";

interface WhiteboardHeaderProps {
  documentId: string;
  conversionLocked?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  currentUserAvatarUrl?: string;
}

export function WhiteboardHeader({
  documentId,
  conversionLocked = false,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
}: WhiteboardHeaderProps) {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const { data: document } = useGetDocument(documentId);
  const updateDocumentMutation = useUpdateDocument();
  const { connectedUsers, connectionStatus } = useCollaboration();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const titleDebounced = useDebounce(title, 500);

  const prevDocumentIdRef = useRef<string | null>(null);
  const prevTitleRef = useRef("");
  const isInitializedRef = useRef(false);

  const isReadOnly =
    (document as { accessLevel?: string } | undefined)?.accessLevel === "view";
  const isOwner =
    (document as { accessLevel?: string } | undefined)?.accessLevel === "owner";
  const canManage =
    (document as { canManage?: boolean } | undefined)?.canManage ?? isOwner;
  const isDeleted = Boolean(document?.deletedAt);
  const editable = !isReadOnly && !isDeleted && canManage && !conversionLocked;

  const isSaving = updateDocumentMutation.isPending;
  const [isSaved, setIsSaved] = useState(false);
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);

  useEffect(() => {
    if (!document || document.id !== documentId) {
      return;
    }

    const isDocumentChanged = documentId !== prevDocumentIdRef.current;
    if (isDocumentChanged) {
      prevDocumentIdRef.current = documentId;
      isInitializedRef.current = false;
      const newTitle = document.title ?? "";
      setTitle(newTitle);
      setIcon(document.icon ?? null);
      prevTitleRef.current = newTitle;
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 600);
      return;
    }

    setIcon(document.icon ?? null);
  }, [document, documentId]);

  useEffect(() => {
    const displayTitle = title.trim() || "未命名白板";
    setPageTitle(`${displayTitle} - 知作`);
    setFavicon(getFaviconUrl(icon));
  }, [icon, title]);

  useEffect(() => {
    if (
      !isInitializedRef.current ||
      !document ||
      !documentId ||
      !editable ||
      titleDebounced === document.title ||
      titleDebounced === prevTitleRef.current
    ) {
      return;
    }

    prevTitleRef.current = titleDebounced;
    updateDocumentMutation.mutate({
      documentId,
      updates: { title: titleDebounced },
    });
  }, [
    document,
    documentId,
    editable,
    titleDebounced,
    updateDocumentMutation,
  ]);

  useEffect(() => {
    if (updateDocumentMutation.isSuccess) {
      setIsSaved(true);
      const timer = setTimeout(() => setIsSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [updateDocumentMutation.isSuccess, updateDocumentMutation.submittedAt]);

  const handleIconSelect = (next: string) => {
    setIcon(next);
    updateDocumentMutation.mutate({ documentId, updates: { icon: next } });
  };

  const handleTitleBlur = () => {
    if (!editable || !document || title === document.title) {
      return;
    }
    prevTitleRef.current = title;
    updateDocumentMutation.mutate({
      documentId,
      updates: { title },
    });
  };

  const viewerAsCollaborator = useMemo((): CollaborativeUser | null => {
    if (!currentUserId) {
      return null;
    }
    const name =
      (currentUserName && currentUserName.trim()) ||
      (currentUserEmail && currentUserEmail.split("@")[0]) ||
      "当前用户";
    return {
      name,
      color: generateUserColor(currentUserId),
      ...(currentUserAvatarUrl ? { avatar: currentUserAvatarUrl } : {}),
    };
  }, [currentUserId, currentUserName, currentUserEmail, currentUserAvatarUrl]);

  const onlineUsers = useMemo(() => {
    const userKey = (u: CollaborativeUser) => `${u.name}|${u.color}`;
    const merged = new Map<string, CollaborativeUser>();
    for (const u of connectedUsers) {
      const k = userKey(u);
      const prev = merged.get(k);
      if (!prev) {
        merged.set(k, u);
        continue;
      }
      if (!prev.avatar && typeof u.avatar === "string" && u.avatar) {
        merged.set(k, u);
      }
    }
    if (viewerAsCollaborator) {
      const k = userKey(viewerAsCollaborator);
      if (!merged.has(k)) {
        merged.set(k, viewerAsCollaborator);
      }
    }
    return Array.from(merged.values());
  }, [connectedUsers, viewerAsCollaborator]);

  const showCollabPresence =
    connectionStatus !== "idle" && onlineUsers.length >= 2;

  const toggleFavorite = () => {
    if (conversionLocked || isUpdatingFavorite) {
      return;
    }
    setIsUpdatingFavorite(true);
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { isFavorite: !document?.isFavorite },
      },
      {
        onSettled: () => setIsUpdatingFavorite(false),
      }
    );
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {(!open || windowWidth < 768) && (
          <SidebarToggle className="" variant="ghost" />
        )}

        {editable ? (
          <EmojiPicker onEmojiSelect={handleIconSelect}>
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-lg hover:bg-muted"
              title="选择图标"
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : isSaved ? (
                <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
              ) : icon ? (
                <span className="leading-none">{icon}</span>
              ) : (
                <PenTool className="size-4 text-muted-foreground" aria-hidden />
              )}
            </button>
          </EmojiPicker>
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md text-lg">
            {icon ? (
              <span className="leading-none">{icon}</span>
            ) : (
              <PenTool className="size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="未命名白板"
          disabled={!editable}
          className="min-w-0 flex-1 truncate border-0 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-default"
        />
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-1",
          conversionLocked && "pointer-events-none select-none opacity-60"
        )}
      >
        {showCollabPresence && (
          <>
            <div className="mr-2 flex items-center gap-2">
              <div className="flex items-center -space-x-2">
                {onlineUsers.slice(0, 5).map((u, index) => (
                  <Avatar
                    key={`${u.name}-${u.color}-${index}`}
                    className="h-7 w-7 border-2 border-background"
                  >
                    <AvatarImage alt={u.name} src={u.avatar} />
                    <AvatarFallback
                      className="text-[10px] font-medium text-white"
                      style={{ backgroundColor: u.color }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {onlineUsers.length > 5 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                    +{onlineUsers.length - 5}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  connectionStatus === "connecting" && "text-yellow-500",
                  connectionStatus === "connected" && "text-green-500",
                  connectionStatus === "disconnected" && "text-red-500"
                )}
              >
                {connectionStatus === "connecting" && (
                  <>
                    <Wifi className="h-3.5 w-3.5 animate-pulse" />
                    <span>连接中...</span>
                  </>
                )}
                {connectionStatus === "connected" && (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    <span>{onlineUsers.length} 人在线</span>
                  </>
                )}
                {connectionStatus === "disconnected" && (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>已断开</span>
                  </>
                )}
              </div>
            </div>
            <Separator orientation="vertical" className="mx-2 h-6" />
          </>
        )}

        {!isDeleted && canManage && (
          <DocumentSharePopover
            documentId={documentId}
            workspaceId={document?.workspaceId ?? null}
            isPubliclyEditable={
              (document as { isPubliclyEditable?: boolean } | undefined)
                ?.isPubliclyEditable ?? false
            }
            isOwner={isOwner}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserEmail={currentUserEmail}
            documentOwnerId={document?.userId}
            hasCollaborators={
              (document as { hasCollaborators?: boolean } | undefined)
                ?.hasCollaborators ?? false
            }
            publicShareToken={
              (document as { publicShareToken?: string | null } | undefined)
                ?.publicShareToken ?? null
            }
          />
        )}

        {!isReadOnly && canManage && (
          <PublishPopover
            documentId={documentId}
            isPublished={document?.isPublished ?? false}
          />
        )}

        {!isDeleted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={toggleFavorite}
            disabled={conversionLocked || isUpdatingFavorite}
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                document?.isFavorite && "fill-yellow-400 text-yellow-400"
              )}
            />
          </Button>
        )}
      </div>
    </header>
  );
}
