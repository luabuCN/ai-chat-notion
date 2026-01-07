"use client";

import { useRouter } from "next/navigation";
import type { User } from "next-auth";

import { BotIcon, ClockRewind } from "@/components/icons";
import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarDocuments } from "@/components/sidebar-documents";
import { SidebarSharedDocuments } from "@/components/sidebar-shared-documents";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SidebarTrash } from "@/components/sidebar-trash";
import {
  WorkspaceSwitcher,
  type Workspace,
} from "@/components/workspace-switcher";
import { useWorkspace } from "@/components/workspace-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
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
} from "@repo/ui";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { currentWorkspace, workspaces, refreshWorkspaces } = useWorkspace();

  const handleWorkspaceSwitch = (workspace: Workspace) => {
    router.push(`/${workspace.slug}/chat`);
    router.refresh();
  };

  const handleSettingsClick = (workspace: Workspace) => {
    // TODO: 创建空间设置页面
    console.log("Settings for workspace:", workspace.slug);
  };

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              {/* 空间切换器 - 登录用户始终显示 */}
              {user && (
                <WorkspaceSwitcher
                  currentWorkspace={currentWorkspace}
                  workspaces={workspaces}
                  userId={user.id!}
                  onSwitch={handleWorkspaceSwitch}
                  onSettingsClick={handleSettingsClick}
                  onRefresh={refreshWorkspaces}
                />
              )}
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
                      if (currentWorkspace) {
                        router.push(`/${currentWorkspace.slug}/chat`);
                      } else if (workspaces.length > 0) {
                        router.push(`/${workspaces[0].slug}/chat`);
                      }
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
          <SidebarSharedDocuments />
          <SidebarTrash />
        </SidebarContent>
        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
      </Sidebar>
    </>
  );
}
