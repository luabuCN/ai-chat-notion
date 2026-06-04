"use client";

import { useRouter } from "next/navigation";
import { Button } from "@repo/ui";
import { useMarkAsRead } from "@/hooks/use-notifications";
import type { Notification } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

export function NotificationItem({
  notification,
  onClose,
}: NotificationItemProps) {
  const router = useRouter();
  const markAsRead = useMarkAsRead();

  const handleClick = () => {
    if (!notification.isRead) {
      markAsRead.mutate(notification.id);
    }
  };

  const handleAcceptInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = notification.payload as Record<string, unknown>;
    if (payload?.inviteToken) {
      router.push(`/invite/${payload.inviteToken}`);
      markAsRead.mutate(notification.id);
      onClose();
    }
  };

  const handleRejectInvite = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead.mutate(notification.id);
  };

  const handleViewDocument = (e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = notification.payload as Record<string, unknown>;
    if (payload?.documentId) {
      router.push(`/documents/${payload.documentId}`);
      markAsRead.mutate(notification.id);
      onClose();
    }
  };

  const timeAgo = formatTimeAgo(notification.createdAt);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex cursor-pointer flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50",
        !notification.isRead && "bg-muted/30"
      )}
    >
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
            {notification.type === "SPACE_INVITE" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 px-2 text-xs"
                  onClick={handleAcceptInvite}
                >
                  接受
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
            {notification.type === "DOC_SHARE" && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={handleViewDocument}
              >
                查看文档
              </Button>
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
