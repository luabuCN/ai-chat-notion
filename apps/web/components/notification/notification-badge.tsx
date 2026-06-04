"use client";

import { useUnreadCount } from "@/hooks/use-notifications";

export function NotificationBadge() {
  const { data: count = 0 } = useUnreadCount();

  if (count === 0) return null;

  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
