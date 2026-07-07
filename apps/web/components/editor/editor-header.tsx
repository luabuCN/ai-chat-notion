"use client";

import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { useWindowSize } from "usehooks-ts";
import { useUpdateDocument } from "@/hooks/use-document-query";
import { useMemo, useState, useRef, useCallback, useEffect, type CSSProperties } from "react";
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
} from "lucide-react";
import { LanguageSwitcher } from "../language-switcher";
import { cn } from "@/lib/utils";
import { PublishPopover } from "./publish-popover";
import { DocumentActionsMenu } from "./document-actions-menu";
import { DocumentSharePopover } from "./document-share-popover";
import { useCollaboration } from "./collaboration-context";
import { generateUserColor } from "@repo/editor";
import type { CollaborativeUser } from "@repo/editor";
import { resolveUserAvatarUrl } from "@repo/database/dicebear-avatar";

function mergeCollaborativeUserFields(
  prev: CollaborativeUser,
  next: CollaborativeUser
): CollaborativeUser {
  return {
    ...prev,
    ...(next.avatar && !prev.avatar ? { avatar: next.avatar } : {}),
    ...(next.email && !prev.email ? { email: next.email } : {}),
  };
}

function CollabPresenceAvatar({
  user,
  userKey,
  isOpen,
  onOpen,
  onScheduleClose,
  onCancelClose,
  style,
}: {
  user: CollaborativeUser;
  userKey: string;
  isOpen: boolean;
  onOpen: (key: string) => void;
  onScheduleClose: (delay?: number) => void;
  onCancelClose: () => void;
  style?: CSSProperties;
}) {
  const avatarSrc = resolveUserAvatarUrl({
    avatarUrl: user.avatar,
    name: user.name,
    email: user.email,
  });

  return (
    <HoverCard open={isOpen}>
      <HoverCardTrigger asChild>
        <button
          className="relative inline-flex size-8 shrink-0 touch-manipulation select-none items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-none outline-none"
          style={style}
          tabIndex={-1}
          type="button"
          aria-label={`${user.name}${user.email ? `，${user.email}` : ""} 在线`}
          onPointerEnter={() => onOpen(userKey)}
          onPointerLeave={() => onScheduleClose(120)}
          onTouchStart={() => onOpen(userKey)}
          onTouchEnd={() => onScheduleClose(600)}
          onClick={(event) => event.preventDefault()}
        >
          <Avatar className="pointer-events-none size-8 border-2 border-white shadow-sm">
            <AvatarImage alt={user.name} src={avatarSrc} />
            <AvatarFallback
              className="text-[11px] font-medium text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 size-1.5 rounded-full bg-green-500 ring-[1.5px] ring-white"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="center"
        className="w-auto px-3 py-2 data-[state=closed]:animate-none data-[state=open]:animate-none"
        side="bottom"
        sideOffset={8}
        onPointerEnter={onCancelClose}
        onPointerLeave={() => onScheduleClose(120)}
      >
        <p className="text-sm font-medium leading-none">{user.name}</p>
        {user.email ? (
          <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}

function CollabPresenceAvatars({ users }: { users: CollaborativeUser[] }) {
  const [openUserKey, setOpenUserKey] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openUser = useCallback(
    (key: string) => {
      cancelClose();
      setOpenUserKey(key);
    },
    [cancelClose]
  );

  const scheduleClose = useCallback(
    (delay = 150) => {
      cancelClose();
      closeTimerRef.current = setTimeout(() => {
        setOpenUserKey(null);
        closeTimerRef.current = null;
      }, delay);
    },
    [cancelClose]
  );

  useEffect(() => {
    return () => cancelClose();
  }, [cancelClose]);

  useEffect(() => {
    if (!openUserKey) {
      return;
    }
    const handleOutsideTouch = (event: TouchEvent) => {
      if (!groupRef.current?.contains(event.target as Node)) {
        scheduleClose(0);
      }
    };
    document.addEventListener("touchstart", handleOutsideTouch, {
      passive: true,
    });
    return () => {
      document.removeEventListener("touchstart", handleOutsideTouch);
    };
  }, [openUserKey, scheduleClose]);

  return (
    <div ref={groupRef} className="mr-2 flex items-center">
      <div className="flex items-center gap-1.5">
        {users.slice(0, 5).map((user) => {
          const userKey = `${user.name}|${user.color}`;
          return (
            <CollabPresenceAvatar
              key={userKey}
              isOpen={openUserKey === userKey}
              onCancelClose={cancelClose}
              onOpen={openUser}
              onScheduleClose={scheduleClose}
              user={user}
              userKey={userKey}
            />
          );
        })}
        {users.length > 5 && (
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] font-medium text-muted-foreground shadow-sm">
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}

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
  canManage?: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserEmail?: string;
  /** 当前用户头像（与协同 awareness 一致） */
  currentUserAvatarUrl?: string;
  documentOwnerId?: string;
  hasCollaborators?: boolean; // 是否有协作者
  publicShareToken?: string | null; // 公开分享链接 token
  /** PDF 转换中：右侧协作/分享/发布/收藏/菜单禁用 */
  conversionLocked?: boolean;
  /** 从 PDF 导入时保存的原文链接，用于菜单内下载 */
  sourcePdfUrl?: string | null;
  /** 扩展侧栏等从网页剪藏时保存的原站 URL，用于标题旁标识与跳转 */
  sourcePageUrl?: string | null;
  /** 全宽模式 */
  isFullWidth?: boolean;
  /** 全宽模式切换 */
  onFullWidthChange?: (checked: boolean) => void;
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
  canManage = isOwner,
  currentUserId,
  currentUserName,
  currentUserEmail,
  currentUserAvatarUrl,
  documentOwnerId,
  hasCollaborators = false,
  publicShareToken,
  conversionLocked = false,
  sourcePdfUrl = null,
  sourcePageUrl = null,
  isFullWidth = false,
  onFullWidthChange,
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
      avatar: resolveUserAvatarUrl({
        avatarUrl: currentUserAvatarUrl,
        name: currentUserName,
        email: currentUserEmail,
        id: currentUserId,
      }),
      ...(currentUserEmail ? { email: currentUserEmail } : {}),
    };
  }, [currentUserId, currentUserName, currentUserEmail, currentUserAvatarUrl]);

  /**
   * 与分享弹窗一致：awareness 为空时用当前用户兜底，并合并进列表。
   * 去重 key 只看 `name|color`（color 由 userId 派生稳定），
   * 否则同一用户在「带 avatar / 不带 avatar」两种 awareness 间会被算成两人。
   */
  const headerOnlineUsers = useMemo(() => {
    const userKey = (u: CollaborativeUser) => `${u.name}|${u.color}`;
    const merged = new Map<string, CollaborativeUser>();
    for (const u of connectedUsers) {
      const k = userKey(u);
      const prev = merged.get(k);
      if (!prev) {
        merged.set(k, u);
        continue;
      }
      merged.set(k, mergeCollaborativeUserFields(prev, u));
    }
    if (viewerAsCollaborator) {
      const k = userKey(viewerAsCollaborator);
      const prev = merged.get(k);
      if (!prev) {
        merged.set(k, viewerAsCollaborator);
      } else {
        merged.set(k, mergeCollaborativeUserFields(prev, viewerAsCollaborator));
      }
    }
    return Array.from(merged.values());
  }, [connectedUsers, viewerAsCollaborator]);

  /** 协同已连接且 ≥2 人在线时展示头像；断开或连接中均隐藏 */
  const showCollabPresence =
    connectionStatus === "connected" && headerOnlineUsers.length >= 2;

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
    <header className="flex items-center justify-between px-4 h-14  shrink-0 gap-2">
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
        {/* 在线用户头像（≥2 人且已连接时展示） */}
        {showCollabPresence && <CollabPresenceAvatars users={headerOnlineUsers} />}

        {showCollabPresence && (
          <Separator orientation="vertical" className="mx-2 h-6" />
        )}

        {/* 分享按钮 - 文档所有者或空间管理员可见 */}
        {!isDeleted && canManage && (
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

        {/* 发布按钮 - 文档所有者或空间管理员可见 */}
        {!readonly && canManage && (
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
              canManage={canManage}
              sourcePdfUrl={sourcePdfUrl}
              sourcePageUrl={sourcePageUrl}
              isFullWidth={isFullWidth}
              onFullWidthChange={onFullWidthChange}
            />
          </>
        )}
      </div>
    </header>
  );
}
