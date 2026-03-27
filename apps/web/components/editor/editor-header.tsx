"use client";

import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
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
  FileText,
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
  /** PDF 转换中：右侧协作/分享/发布/收藏/菜单禁用 */
  conversionLocked?: boolean;
  /** 从 PDF 导入时保存的原文链接，用于菜单内下载 */
  sourcePdfUrl?: string | null;
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
  conversionLocked = false,
  sourcePdfUrl = null,
}: EditorHeaderProps) {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const updateDocumentMutation = useUpdateDocument();
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const { connectedUsers, connectionStatus } = useCollaboration();

  const toggleFavorite = () => {
    if (conversionLocked || isUpdatingFavorite) return;
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
        <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <div className="p-1 bg-muted rounded-sm flex items-center justify-center min-w-[24px] min-h-[24px] shrink-0">
            {isSaving ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
            ) : isSaved ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : documentIcon ? (
              <span className="text-base leading-none">{documentIcon}</span>
            ) : null}
          </div>
          <h1 className="min-w-0 flex-1 truncate font-semibold text-sm">
            {documentTitle || "未命名"}
          </h1>
          {sourcePdfUrl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="inline-flex shrink-0 items-center rounded border border-red-200/90 bg-red-50 px-1 py-0.5 text-red-700 transition-colors hover:bg-red-100/80 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950/80"
                  type="button"
                  aria-label="由 PDF 转换的文档"
                >
                  <FileText className="size-3.5" aria-hidden />
                  <span className="sr-only">PDF</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="bottom">
                本文档由 PDF 导入并转换生成；可在右上角「⋯」菜单中下载原始 PDF。
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1",
          conversionLocked && "pointer-events-none select-none opacity-60"
        )}
      >
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

        {/* 分享按钮 - 仅文档所有者可见 */}
        {!isDeleted && isOwner && (
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

        {/* 发布按钮 - 仅文档所有者可见 */}
        {!readonly && isOwner && (
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

        {/* 收藏和操作菜单 - 所有用户可见(包括只读用户) */}
        {!isDeleted && (
          <>
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
                  isFavorite && "fill-yellow-400 text-yellow-400"
                )}
              />
            </Button>

            <DocumentActionsMenu
              documentId={documentId}
              title={documentTitle || "Untitled"}
              isOwner={isOwner}
              sourcePdfUrl={sourcePdfUrl}
            />
          </>
        )}
      </div>
    </header>
  );
}
