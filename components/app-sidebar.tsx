"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";

import { BotIcon, ClockRewind } from "@/components/icons";
import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarDocuments } from "@/components/sidebar-documents";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarToggle } from "@/components/sidebar-toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              <Link
                className="flex flex-row items-center gap-3"
                href="/chat"
                onClick={() => {
                  setOpenMobile(false);
                }}
              >
                <span className="cursor-pointer rounded-md px-2 text-lg font-semibold hover:bg-muted">
                  Chatbot
                </span>
              </Link>
              <div className="flex flex-row gap-1">
                <SidebarToggle variant="ghost" />
              </div>
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => {
                      setOpenMobile(false);
                      router.push("/chat");
                      router.refresh();
                    }}
                  >
                    <BotIcon />
                    <span>AI 灵感小助手</span>
                  </SidebarMenuButton>
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <ClockRewind />
                        <span className="sr-only">History</span>
                      </SidebarMenuAction>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-80 p-0">
                      <SidebarHistory user={user} />
                    </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarDocuments />
        </SidebarContent>
        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
      </Sidebar>
    </>
  );
}
