"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui";
import { NotificationBadge } from "./notification-badge";
import { NotificationList } from "./notification-list";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);

  return (
    <SidebarMenuItem>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <SidebarMenuButton isActive={false}>
            <Bell className="size-4" />
            <span>通知</span>
            <NotificationBadge />
          </SidebarMenuButton>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="right"
          sideOffset={8}
          className="w-[400px] overflow-hidden p-0 shadow-lg"
        >
          <NotificationList onClose={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    </SidebarMenuItem>
  );
}
