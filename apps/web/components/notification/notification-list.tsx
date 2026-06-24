"use client";

import { useState } from "react";
import { useNotifications, useMarkAllAsRead } from "@/hooks/use-notifications";
import { NotificationItem } from "./notification-item";
import { NotificationEmptyState } from "./notification-empty-state";
import { Button, ScrollArea } from "@repo/ui";
import { cn } from "@/lib/utils";

const TABS = [
  { key: undefined, label: "全部" },
  { key: "invite", label: "邀请" },
  { key: "permission", label: "权限" },
] as const;

function getTabType(tabKey: string | undefined): string | undefined {
  switch (tabKey) {
    case "invite":
      return "SPACE_INVITE,DOC_SHARE";
    case "permission":
      return "DOC_PERMISSION_CHANGED,SPACE_PERMISSION_CHANGED,DOC_REMOVED,SPACE_REMOVED";
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
    <div className="flex flex-col overflow-hidden rounded-lg">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">通知</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => markAllAsRead.mutate()}
          >
            全部已读
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b px-3 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.key ?? "all"}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-background"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ScrollArea className="h-[400px]">
        {isLoading ? (
          <div className="space-y-0 divide-y">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse px-4 py-3">
                <div className="mb-2 h-3.5 w-3/4 rounded bg-muted" />
                <div className="mb-2 h-3 w-1/2 rounded bg-muted/70" />
                <div className="h-2.5 w-16 rounded bg-muted/50" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <NotificationEmptyState />
        ) : (
          <div className="divide-y divide-border/60">
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
