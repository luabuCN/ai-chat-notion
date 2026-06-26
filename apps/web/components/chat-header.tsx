"use client";

import { useParams, useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import type { User } from "next-auth";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SidebarHistory } from "@/components/sidebar-history";
import { ClockRewind, PlusIcon } from "./icons";
import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useSidebar,
} from "@repo/ui";

function PureChatHeader({ chatId, user }: { chatId: string; user?: User }) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const { open } = useSidebar();
  const [historyOpen, setHistoryOpen] = useState(false);

  const { width: windowWidth } = useWindowSize();

  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
        {(!open || windowWidth < 768) && (
          <>
            <SidebarToggle variant="outline" />
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    router.push(`/${workspaceSlug}/chat`);
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                  <span className="sr-only">新建对话</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>新建对话</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setHistoryOpen(true)}
                >
                  <ClockRewind />
                  <span className="sr-only">历史记录</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>历史记录</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
        <SheetContent className="w-80 p-0 sm:max-w-80">
          <SheetTitle className="sr-only">History</SheetTitle>
          <SidebarHistory enabled={historyOpen} user={user} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.chatId === nextProps.chatId;
});
