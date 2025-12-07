"use client";

import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  useSidebar,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Separator,
} from "@repo/ui";
import { useWindowSize } from "usehooks-ts";
import {
  Share,
  Clock,
  Star,
  MoreHorizontal,
  MessageSquare,
  Edit,
} from "lucide-react";

export function EditorHeader() {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  return (
    <header className="flex items-center justify-between px-4 h-14 border-b shrink-0 gap-2">
      <div className="flex items-center gap-2">
        {(!open || windowWidth < 768) && (
          <SidebarToggle className="" variant="ghost" />
        )}
        <div className="flex items-center gap-2 px-2">
          <div className="p-1 bg-muted rounded-sm">
            <Edit className="h-4 w-4 text-muted-foreground" />
          </div>
          <h1 className="font-semibold text-sm truncate">快速开始 IdeaForge</h1>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="flex items-center -space-x-2 mr-2">
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarImage src="https://github.com/vercel.png" />
            <AvatarFallback>VC</AvatarFallback>
          </Avatar>
          <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
            +3
          </div>
        </div>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
          Share
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <Clock className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <Star className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
