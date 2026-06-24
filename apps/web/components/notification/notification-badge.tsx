"use client";

import { useUnreadCount } from "@/hooks/use-notifications";

export function NotificationBadge() {
  const { data: count = 0 } = useUnreadCount();

  if (count === 0) return null;

  return (
    <span className="ml-auto inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive/10 px-0.5 text-[9px] font-medium leading-none tabular-nums text-destructive/70">
      {count > 99 ? "99+" : count}
    </span>
  );
}
