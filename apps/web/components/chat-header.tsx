"use client";

import { useParams, useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import type { User } from "next-auth";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SidebarHistory } from "@/components/sidebar-history";
import { ClockRewind, PlusIcon } from "./icons";
import { Button, Sheet, SheetContent, SheetTitle } from "@repo/ui";
import { useSidebar } from "@repo/ui";

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
            <Button
              className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
              onClick={() => {
                router.push(`/${workspaceSlug}/chat`);
                router.refresh();
              }}
              variant="outline"
            >
              <PlusIcon />
              <span className="md:sr-only">New Chat</span>
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setHistoryOpen(true)}
          >
            <ClockRewind />
            <span className="sr-only">History</span>
          </Button>
        </div>
      </header>

      <Sheet onOpenChange={setHistoryOpen} open={historyOpen}>
        <SheetContent className="w-80 p-0 sm:max-w-80">
          <SheetTitle className="sr-only">History</SheetTitle>
          <SidebarHistory user={user} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.chatId === nextProps.chatId;
});
