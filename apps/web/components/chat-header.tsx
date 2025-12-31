"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@repo/ui";
import { PlusIcon, VercelIcon } from "./icons";
import { useSidebar } from "@repo/ui";

function PureChatHeader({ chatId }: { chatId: string }) {
  const router = useRouter();
  const params = useParams();
  const workspaceSlug =
    typeof params.slug === "string"
      ? params.slug
      : Array.isArray(params.slug)
      ? params.slug[0]
      : "";
  const { open } = useSidebar();

  const { width: windowWidth } = useWindowSize();

  return (
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
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.chatId === nextProps.chatId;
});
