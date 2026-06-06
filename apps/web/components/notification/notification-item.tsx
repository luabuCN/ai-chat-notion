"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import {
  useMarkAsRead,
  useDeleteNotification,
  useMarkActionTaken,
  getNotificationActionStatus,
} from "@/hooks/use-notifications";
import type { Notification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Check, Trash2, X } from "lucide-react";

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

function isInviteType(type: string): boolean {
  return type === "SPACE_INVITE" || type === "DOC_SHARE";
}

function isOnDocument(pathname: string | null, documentId: string): boolean {
  if (!pathname) return false;
  return pathname.includes(`/editor/${documentId}`);
}

function isOnWorkspace(pathname: string | null, workspaceSlug: string): boolean {
  if (!pathname) return false;
  return pathname.startsWith(`/${workspaceSlug}/`);
}

export function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const router = useRouter();
  const pathname = usePathname();
  const markAsRead = useMarkAsRead();
  const deleteNotification = useDeleteNotification();
  const markActionTaken = useMarkActionTaken();
  const [accepting, setAccepting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const payload = notification.payload as Record<string, unknown> | null;
  const actionStatus = getNotificationActionStatus(notification);
  const isRejected = actionStatus === "rejected";
  const isAccepted = actionStatus === "accepted";
  const showInviteButtons =
    isInviteType(notification.type) && actionStatus === null;

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
  };

  const handleNavigate = () => {
    if (isRejected) return;

    switch (notification.type) {
      case "DOC_PERMISSION_CHANGED":
      case "DOC_SHARE": {
        const documentId = payload?.documentId as string | undefined;
        if (documentId && !isOnDocument(pathname, documentId)) {
          onClose();
          router.push(`/editor/${documentId}`);
        }
        break;
      }
      case "SPACE_INVITE": {
        if (!isAccepted) return;
        const workspaceSlug = payload?.workspaceSlug as string | undefined;
        if (workspaceSlug && !isOnWorkspace(pathname, workspaceSlug)) {
          onClose();
          router.push(`/${workspaceSlug}/chat`);
          router.refresh();
        }
        break;
      }
      case "MENTION": {
        const documentId = payload?.documentId as string | undefined;
        const commentId = payload?.commentId as string | undefined;
        const blockId = payload?.blockId as string | undefined;
        if (documentId) {
          onClose();
          const params = new URLSearchParams();
          if (commentId) params.set("comment", commentId);
          if (blockId) params.set("block", blockId);
          const qs = params.toString();
          router.push(`/editor/${documentId}${qs ? `?${qs}` : ""}`);
        }
        break;
      }
      default:
        break;
    }
  };

  const handleContainerClick = () => {
    if (isRejected) return;

    if (notification.type === "DOC_PERMISSION_CHANGED") {
      handleNavigate();
      return;
    }

    if (notification.type === "MENTION") {
      handleNavigate();
      return;
    }

    if (isInviteType(notification.type)) {
      if (isAccepted) {
        handleNavigate();
      }
      return;
    }
  };

  const handleAcceptSpaceInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (accepting || !payload?.inviteToken) return;

    setAccepting(true);
    try {
      const res = await apiFetch("/api/invite/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: payload.inviteToken }),
      });
      if (res.ok) {
        const workspace = await res.json();
        markAsRead.mutate(notification.id);
        markActionTaken.mutate({
          notificationId: notification.id,
          status: "accepted",
          extraPayload: { workspaceSlug: workspace.slug },
        });
        onClose();
        router.push(`/${workspace.slug}/chat`);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setAccepting(false);
    }
  };

  const handleAcceptDocShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (accepting || !payload?.inviteToken) return;

    setAccepting(true);
    try {
      const res = await apiFetch(
        `/api/editor-documents/collaborator-invite/${payload.inviteToken}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        markAsRead.mutate(notification.id);
        markActionTaken.mutate({
          notificationId: notification.id,
          status: "accepted",
          extraPayload: { documentId: data.documentId },
        });
        onClose();
        router.push(`/editor/${data.documentId}`);
      }
    } catch {
      // ignore
    } finally {
      setAccepting(false);
    }
  };

  const handleRejectInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead.mutate(notification.id);
    markActionTaken.mutate({
      notificationId: notification.id,
      status: "rejected",
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    deleteNotification.mutate(notification.id);
  };

  const timeAgo = formatTimeAgo(notification.createdAt);
  const isClickable =
    !isRejected &&
    (notification.type === "DOC_PERMISSION_CHANGED" ||
      notification.type === "MENTION" ||
      (isInviteType(notification.type) && isAccepted));

  return (
    <div
      onClick={isClickable ? handleContainerClick : undefined}
      className={cn(
        "group relative px-4 py-3 transition-colors",
        !notification.isRead && "border-l-2 border-l-primary bg-primary/3",
        notification.isRead && "border-l-2 border-l-transparent",
        isClickable && "cursor-pointer hover:bg-muted/40",
        isRejected && "cursor-default opacity-55"
      )}
    >
      <div className="flex items-start gap-3 pr-14">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[13px] font-medium leading-snug text-foreground",
              isRejected && "text-muted-foreground line-through decoration-muted-foreground/40"
            )}
          >
            {notification.title}
          </p>
          {notification.content && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {notification.content}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {showInviteButtons && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2.5 text-xs"
                  onClick={
                    notification.type === "SPACE_INVITE"
                      ? handleAcceptSpaceInvite
                      : handleAcceptDocShare
                  }
                  disabled={accepting}
                >
                  {accepting ? "处理中..." : "接受"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2.5 text-xs"
                  onClick={handleRejectInvite}
                >
                  拒绝
                </Button>
              </>
            )}

            {isAccepted && isInviteType(notification.type) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="size-3" strokeWidth={2.5} />
                已接受
              </span>
            )}

            {isRejected && isInviteType(notification.type) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <X className="size-3" strokeWidth={2.5} />
                已拒绝
              </span>
            )}

            <span className="ml-auto text-[11px] tabular-nums text-muted-foreground/80">
              {timeAgo}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-0.5">
        {notification.isRead ? (
          <span
            className="flex size-6 items-center justify-center opacity-0 transition-opacity group-hover:opacity-50"
            title="已读"
            aria-hidden
          >
            <span className="size-2 rounded-full border border-muted-foreground/50" />
          </span>
        ) : (
          <button
            type="button"
            onClick={handleMarkAsRead}
            className="flex size-6 items-center justify-center rounded text-primary transition-colors hover:bg-primary/10"
            title="标为已读"
            aria-label="标为已读"
          >
            <span className="size-2 rounded-full bg-primary" />
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex size-6 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          title="删除通知"
          aria-label="删除通知"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}
