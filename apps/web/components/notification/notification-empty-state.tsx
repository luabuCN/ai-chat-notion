import { Bell } from "lucide-react";

export function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/60">
        <Bell className="size-5 text-muted-foreground/70" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-medium text-foreground/80">没有新通知</p>
      <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
        您将在这里收到 @提及 和工作区邀请的通知。
      </p>
    </div>
  );
}
