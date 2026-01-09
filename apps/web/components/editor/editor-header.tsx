"use client";

import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
} from "@repo/ui";
import { useWindowSize } from "usehooks-ts";
import { useUpdateDocument } from "@/hooks/use-document-query";
import { useState } from "react";
import {
  Share,
  Clock,
  Star,
  MoreHorizontal,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import { cn } from "@/lib/utils";
import { PublishPopover } from "./publish-popover";
import { DocumentActionsMenu } from "./document-actions-menu";
import { DocumentSharePopover } from "./document-share-popover";
import { useCollaboration } from "./collaboration-context";

interface EditorHeaderProps {
  locale: string;
  documentTitle?: string;
  documentIcon?: string | null;
  documentId: string;
  workspaceId?: string | null;
  isPublished?: boolean;
  isFavorite?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
  isDeleted?: boolean;
  readonly?: boolean; // 只读模式，隐藏编辑相关按钮
  isOwner?: boolean;
  currentUserId?: string;
  documentOwnerId?: string;
  hasCollaborators?: boolean; // 是否有协作者
  publicShareToken?: string | null; // 公开分享链接 token
}

export function EditorHeader({
  locale,
  documentTitle,
  documentIcon,
  documentId,
  workspaceId = null,
  isPublished = false,
  isFavorite = false,
  isSaving = false,
  isSaved = false,
  isDeleted = false,
  readonly = false,
  isOwner = false,
  currentUserId,
  documentOwnerId,
  hasCollaborators = false,
  publicShareToken,
}: EditorHeaderProps) {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const updateDocumentMutation = useUpdateDocument();
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const { connectedUsers, connectionStatus } = useCollaboration();

  const toggleFavorite = () => {
    if (isUpdatingFavorite) return;
    setIsUpdatingFavorite(true);
    updateDocumentMutation.mutate(
      {
        documentId,
        updates: { isFavorite: !isFavorite },
      },
      {
        onSettled: () => setIsUpdatingFavorite(false),
      }
    );
  };

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b shrink-0 gap-2">
      <div className="flex items-center gap-2">
        {(!open || windowWidth < 768) && (
          <SidebarToggle className="" variant="ghost" />
        )}
        <div className="flex items-center gap-2 px-2">
          <div className="p-1 bg-muted rounded-sm flex items-center justify-center min-w-[24px] min-h-[24px]">
            {isSaving ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : documentIcon ? (
              <span className="text-base leading-none">{documentIcon}</span>
            ) : null}
          </div>
          <h1 className="font-semibold text-sm truncate">
            {documentTitle || "未命名"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* 在线用户头像和连接状态 */}
        {connectionStatus !== "idle" && (
          <div className="flex items-center gap-2 mr-2">
            {/* 用户头像 */}
            {connectedUsers.length > 0 && (
              <div className="flex items-center -space-x-2">
                {connectedUsers.slice(0, 5).map((user, index) => (
                  <Avatar
                    key={`${user.name}-${index}`}
                    className="h-7 w-7 border-2 border-background"
                    style={{ backgroundColor: user.color }}
                  >
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback
                      className="text-[10px] font-medium text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {connectedUsers.length > 5 && (
                  <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                    +{connectedUsers.length - 5}
                  </div>
                )}
              </div>
            )}
            {/* 连接状态指示器 */}
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
                  <span>{connectedUsers.length} 人在线</span>
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
        )}

        {connectionStatus !== "idle" && (
          <Separator orientation="vertical" className="h-6 mx-2" />
        )}

        {/* 分享按钮 */}
        {!isDeleted && (
          <DocumentSharePopover
            documentId={documentId}
            workspaceId={workspaceId}
            isPublished={isPublished}
            isOwner={isOwner}
            currentUserId={currentUserId}
            documentOwnerId={documentOwnerId}
            hasCollaborators={hasCollaborators}
            publicShareToken={publicShareToken}
          />
        )}

        {!readonly && (
          <PublishPopover documentId={documentId} isPublished={isPublished} />
        )}

        {/* <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <Clock className="h-4 w-4" />
        </Button> */}

        {/* <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <MessageSquare className="h-4 w-4" />
        </Button> */}

        {!isDeleted && !readonly && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={toggleFavorite}
              disabled={isUpdatingFavorite}
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-colors",
                  isFavorite && "fill-yellow-400 text-yellow-400"
                )}
              />
            </Button>

            <DocumentActionsMenu
              documentId={documentId}
              title={documentTitle || "Untitled"}
            />
          </>
        )}
      </div>
    </header>
  );
}
