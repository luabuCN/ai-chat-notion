"use client";

import { useState } from "react";
import { useNotifications, useMarkAllAsRead } from "@/hooks/use-notifications";
import { NotificationItem } from "./notification-item";
import { Button, ScrollArea } from "@repo/ui";

const TABS = [
  { key: undefined, label: "全部" },
  { key: "invite", label: "邀请" },
  { key: "permission", label: "权限" },
] as const;

// Map tab key to NotificationType filter values
function getTabType(tabKey: string | undefined): string | undefined {
  switch (tabKey) {
    case "invite":
      return "SPACE_INVITE";
    case "permission":
      return "DOC_PERMISSION_CHANGED";
    default:
      return undefined;
  }
}

interface NotificationListProps {
  onClose: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const type = getTabType(activeTab);
  const { data, isLoading } = useNotifications({ type });
  const markAllAsRead = useMarkAllAsRead();

  const notifications = data?.list ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">通知</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground"
            onClick={() => markAllAsRead.mutate()}
          >
            全部已读
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b px-4 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.key ?? "all"}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <ScrollArea className="h-[380px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            暂无通知
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClose={onClose}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
