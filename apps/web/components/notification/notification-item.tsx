"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import {
  useMarkAsRead,
  useDeleteNotification,
  useMarkActionTaken,
} from "@/hooks/use-notifications";
import type { Notification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Trash2 } from "lucide-react";

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

function isInviteType(type: string): boolean {
  return type === "SPACE_INVITE" || type === "DOC_SHARE";
}

function isActionTaken(notification: Notification): boolean {
  const payload = notification.payload as Record<string, unknown> | null;
  return !!payload?.actionTaken;
}

export function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const router = useRouter();
  const markAsRead = useMarkAsRead();
  const deleteNotification = useDeleteNotification();
  const markActionTaken = useMarkActionTaken();
  const [accepting, setAccepting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleContainerClick = () => {
    // 点击即标记已读
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }

    const payload = notification.payload as Record<string, unknown> | null;

    switch (notification.type) {
      // 文档权限变更：跳转到对应文档
      case "DOC_PERMISSION_CHANGED":
        if (payload?.documentId) {
          router.push(`/editor/${payload.documentId}`);
          onClose();
        }
        break;

      // 空间权限变更 / 文档移除 / 空间移除：只标记已读，不触发跳转
      case "SPACE_PERMISSION_CHANGED":
      case "DOC_REMOVED":
      case "SPACE_REMOVED":
        break;

      // 邀请类：未 action 时只标记已读，已 action 后也只标记已读
      default:
        break;
    }
  };

  // D1: SPACE_INVITE — accept: join directly, navigate to workspace
  const handleAcceptSpaceInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (accepting) return;
    const payload = notification.payload as Record<string, unknown>;
    if (!payload?.inviteToken) return;

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
        markActionTaken.mutate(notification.id);
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

  // D2: DOC_SHARE — accept: join directly, navigate to document
  const handleAcceptDocShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (accepting) return;
    const payload = notification.payload as Record<string, unknown>;
    if (!payload?.inviteToken) return;

    setAccepting(true);
    try {
      const res = await apiFetch(
        `/api/editor-documents/collaborator-invite/${payload.inviteToken}`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        markAsRead.mutate(notification.id);
        markActionTaken.mutate(notification.id);
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
    markActionTaken.mutate(notification.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    deleteNotification.mutate(notification.id);
  };

  const timeAgo = formatTimeAgo(notification.createdAt);
  const showInviteButtons =
    isInviteType(notification.type) &&
    !isActionTaken(notification);

  return (
    <div
      onClick={handleContainerClick}
      className={cn(
        "group relative cursor-pointer px-4 py-2 transition-colors hover:bg-muted/50",
        !notification.isRead && "bg-muted/30"
      )}
    >
      {/* 删除按钮：绝对定位，垂直居中于整个 item */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute right-2 top-1  opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
        title="删除通知"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-2">
        {!notification.isRead && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            {notification.title}
          </p>
          {notification.content && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {notification.content}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {showInviteButtons && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-xs"
                  onClick={
                    notification.type === "SPACE_INVITE"
                      ? handleAcceptSpaceInvite
                      : handleAcceptDocShare
                  }
                  disabled={accepting}
                >
                  {accepting
                    ? notification.type === "SPACE_INVITE"
                      ? "加入中..."
                      : "接受中..."
                    : "接受"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={handleRejectInvite}
                >
                  拒绝
                </Button>
              </>
            )}
            <span className="text-[11px] text-muted-foreground ml-auto">
              {timeAgo}
            </span>
          </div>
        </div>
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
