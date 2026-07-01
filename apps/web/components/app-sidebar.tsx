"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
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

function SidebarNavLink({
  href,
  isActive,
  onNavigate,
  children,
}: {
  href: string | null;
  isActive: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <SidebarMenuButton isActive={isActive} disabled>
        {children}
      </SidebarMenuButton>
    );
  }

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      <Link
        href={href}
        onClick={onNavigate}
        className="no-underline text-sidebar-foreground [&_svg]:text-sidebar-foreground hover:text-sidebar-accent-foreground hover:[&_svg]:text-sidebar-accent-foreground"
      >
        {children}
      </Link>
    </SidebarMenuButton>
  );
}

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { currentWorkspace, workspaces, refreshWorkspaces } = useWorkspace();
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  const isChatActive = /\/[^\/]+\/chat(\/|$)/.test(pathname ?? "");
  const isImageActive = /\/[^\/]+\/image(\/|$)/.test(pathname ?? "");
  const isDocumentsActive = /\/[^\/]+\/documents(\/|$)/.test(pathname ?? "");

  const activeSlug = currentWorkspace?.slug ?? workspaces[0]?.slug ?? null;

  const closeMobileSidebar = () => {
    setOpenMobile(false);
  };

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
                      closeMobileSidebar();
                      setQuickSearchOpen(true);
                    }}
                  >
                    <Search className="size-4" />
                    <span>快速搜索</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarNavLink
                    href={activeSlug ? `/${activeSlug}/chat` : null}
                    isActive={isChatActive}
                    onNavigate={closeMobileSidebar}
                  >
                    <Sparkles />
                    <span>AI 灵感助手</span>
                  </SidebarNavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarNavLink
                    href={activeSlug ? `/${activeSlug}/image` : null}
                    isActive={isImageActive}
                    onNavigate={closeMobileSidebar}
                  >
                    <ImageIcon />
                    <span>AI 创作工坊</span>
                  </SidebarNavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarNavLink
                    href={activeSlug ? `/${activeSlug}/documents` : null}
                    isActive={isDocumentsActive}
                    onNavigate={closeMobileSidebar}
                  >
                    <FileText className="size-4" />
                    <span>所有文档</span>
                  </SidebarNavLink>
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
