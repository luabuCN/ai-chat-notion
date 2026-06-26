"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "next-auth";

import { ImageIcon } from "@/components/icons";
import { FileText, Search, Sparkles } from "lucide-react";
import { SidebarDocuments } from "@/components/sidebar-documents";
import { SidebarSharedDocuments } from "@/components/sidebar-shared-documents";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { SidebarTrash } from "@/components/sidebar-trash";
import { QuickSearchPalette } from "@/components/quick-search-palette";
import { NotificationCenter } from "@/components/notification/notification-center";
import {
  WorkspaceSwitcher,
  type Workspace,
} from "@/components/workspace-switcher";
import { useWorkspace } from "@/components/workspace-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { currentWorkspace, workspaces, refreshWorkspaces } = useWorkspace();
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  const isChatActive = /\/[^\/]+\/chat(\/|$)/.test(pathname ?? "");
  const isImageActive = /\/[^\/]+\/image(\/|$)/.test(pathname ?? "");
  const isDocumentsActive = /\/[^\/]+\/documents(\/|$)/.test(pathname ?? "");

  const activeSlug = currentWorkspace?.slug ?? workspaces[0]?.slug;

  const prefetchPaths = useMemo(
    () =>
      activeSlug
        ? [
            `/${activeSlug}/chat`,
            `/${activeSlug}/image`,
            `/${activeSlug}/documents`,
          ]
        : [],
    [activeSlug],
  );

  useEffect(() => {
    for (const path of prefetchPaths) {
      router.prefetch(path);
    }
  }, [router, prefetchPaths]);

  const handleWorkspaceSwitch = (workspace: Workspace) => {
    router.push(`/${workspace.slug}/chat`);
    router.refresh();
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
                  userName={user.name}
                  onSwitch={handleWorkspaceSwitch}
                  onRefresh={refreshWorkspaces}
                />
              )}
              <div className="flex flex-row gap-1">
                <SidebarToggle variant="ghost" />
              </div>
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="overflow-hidden">
          <SidebarGroup className="flex-shrink-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={false}
                    onClick={() => {
                      setOpenMobile(false);
                      setQuickSearchOpen(true);
                    }}
                  >
                    <Search className="size-4" />
                    <span>快速搜索</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isChatActive}
                    onMouseEnter={() => {
                      if (activeSlug) router.prefetch(`/${activeSlug}/chat`);
                    }}
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
                    <Sparkles />
                    <span>AI 灵感助手</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isImageActive}
                    onMouseEnter={() => {
                      if (activeSlug) router.prefetch(`/${activeSlug}/image`);
                    }}
                    onClick={() => {
                      setOpenMobile(false);
                      if (currentWorkspace) {
                        router.push(`/${currentWorkspace.slug}/image`);
                      } else if (workspaces.length > 0) {
                        router.push(`/${workspaces[0].slug}/image`);
                      }
                      router.refresh();
                    }}
                  >
                    <ImageIcon />
                    <span>AI 创作工坊</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isDocumentsActive}
                    onMouseEnter={() => {
                      if (activeSlug)
                        router.prefetch(`/${activeSlug}/documents`);
                    }}
                    onClick={() => {
                      setOpenMobile(false);
                      if (currentWorkspace) {
                        router.push(`/${currentWorkspace.slug}/documents`);
                      } else if (workspaces.length > 0) {
                        router.push(`/${workspaces[0].slug}/documents`);
                      }
                      router.refresh();
                    }}
                  >
                    <FileText className="size-4" />
                    <span>所有文档</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <NotificationCenter />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarDocuments />
          <SidebarSharedDocuments />
          <SidebarTrash />
        </SidebarContent>
        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
      </Sidebar>
      <QuickSearchPalette
        open={quickSearchOpen}
        onOpenChange={setQuickSearchOpen}
        workspaceId={currentWorkspace?.id}
      />
    </>
  );
}
