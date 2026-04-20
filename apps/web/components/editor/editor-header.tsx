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
import { useMemo, useState } from "react";
import {
  Share,
  Clock,
  Star,
  MoreHorizontal,
  MessageSquare,
  Loader2,
  CheckCircle2,
  FileText,
  Globe,
  Wifi,
  WifiOff,
} from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import { cn } from "@/lib/utils";
import { PublishPopover } from "./publish-popover";
import { DocumentActionsMenu } from "./document-actions-menu";
import { DocumentSharePopover } from "./document-share-popover";
import { useCollaboration } from "./collaboration-context";
import { generateUserColor } from "@repo/editor";
import type { CollaborativeUser } from "@repo/editor";

interface EditorHeaderProps {
  locale: string;
  documentTitle?: string;
  documentIcon?: string | null;
  documentId: string;
  workspaceId?: string | null;
  isPublished?: boolean;
  /** 公开协作：匿名用户可编辑（与 isPublished 相互独立） */
  isPubliclyEditable?: boolean;
  isFavorite?: boolean;
  isSaving?: boolean;
  isSaved?: boolean;
  isDeleted?: boolean;
  readonly?: boolean; // 只读模式，隐藏编辑相关按钮
  isOwner?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  documentOwnerId?: string;
  hasCollaborators?: boolean; // 是否有协作者
  publicShareToken?: string | null; // 公开分享链接 token
  /** PDF 转换中：右侧协作/分享/发布/收藏/菜单禁用 */
  conversionLocked?: boolean;
  /** 从 PDF 导入时保存的原文链接，用于菜单内下载 */
  sourcePdfUrl?: string | null;
  /** 扩展侧栏等从网页剪藏时保存的原站 URL，用于标题旁标识与跳转 */
  sourcePageUrl?: string | null;
}

export function EditorHeader({
  locale,
  documentTitle,
  documentIcon,
  documentId,
  workspaceId = null,
  isPublished = false,
  isPubliclyEditable = false,
  isFavorite = false,
  isSaving = false,
  isSaved = false,
  isDeleted = false,
  readonly = false,
  isOwner = false,
  currentUserId,
  currentUserName,
  currentUserEmail,
  documentOwnerId,
  hasCollaborators = false,
  publicShareToken,
  conversionLocked = false,
  sourcePdfUrl = null,
  sourcePageUrl = null,
}: EditorHeaderProps) {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const updateDocumentMutation = useUpdateDocument();
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);
  const { connectedUsers, connectionStatus } = useCollaboration();

  const viewerAsCollaborator = useMemo((): CollaborativeUser | null => {
    if (!currentUserId) return null;
    const name =
      (currentUserName && currentUserName.trim()) ||
      (currentUserEmail && currentUserEmail.split("@")[0]) ||
      "当前用户";
    return {
      name,
      color: generateUserColor(currentUserId),
    };
  }, [currentUserId, currentUserName, currentUserEmail]);

  /** 与分享弹窗一致：awareness 为空时用当前用户兜底，并合并进列表 */
  const headerOnlineUsers = useMemo(() => {
    if (!viewerAsCollaborator) {
      return connectedUsers;
    }
    const userKey = (u: CollaborativeUser) =>
      `${u.name}|${u.color}|${typeof u.avatar === "string" ? u.avatar : ""}`;
    const existing = new Set(connectedUsers.map(userKey));
    if (connectedUsers.length === 0) {
      return [viewerAsCollaborator];
    }
    if (existing.has(userKey(viewerAsCollaborator))) {
      return connectedUsers;
    }
    return [...connectedUsers, viewerAsCollaborator];
  }, [connectedUsers, viewerAsCollaborator]);

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
          ) : sourcePageUrl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  className="inline-flex shrink-0 items-center rounded border border-sky-200/90 bg-sky-50 px-1 py-0.5 text-sky-800 transition-colors hover:bg-sky-100/80 dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950/80"
                  href={sourcePageUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  aria-label="由网页保存的文档，在新标签页打开原页面"
                >
                  <Globe className="size-3.5 shrink-0" aria-hidden />
                  <span className="sr-only">网页</span>
                </a>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="bottom">
                本文档由浏览器扩展从网页保存；点击在新标签页打开原页面。
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
        {/* 在线用户头像和连接状态（协同模式） */}
        {connectionStatus !== "idle" && (
          <div className="flex items-center gap-2 mr-2">
            {headerOnlineUsers.length > 0 && (
              <div className="flex items-center -space-x-2">
                {headerOnlineUsers.slice(0, 5).map((user, index) => (
                  <Avatar
                    key={`${user.name}-${user.color}-${index}`}
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
                {headerOnlineUsers.length > 5 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium text-muted-foreground">
                    +{headerOnlineUsers.length - 5}
                  </div>
                )}
              </div>
            )}
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
                  <span>{headerOnlineUsers.length} 人在线</span>
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
          <Separator orientation="vertical" className="mx-2 h-6" />
        )}

        {/* 分享按钮 - 仅文档所有者可见 */}
        {!isDeleted && isOwner && (
          <DocumentSharePopover
            documentId={documentId}
            workspaceId={workspaceId}
            isPubliclyEditable={isPubliclyEditable}
            isOwner={isOwner}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserEmail={currentUserEmail}
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
              sourcePageUrl={sourcePageUrl}
            />
          </>
        )}
      </div>
    </header>
  );
}
