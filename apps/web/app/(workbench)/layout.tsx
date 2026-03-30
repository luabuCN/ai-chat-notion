import { cookies } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { MaterialLibraryDialog } from "@/components/editor/material-library-dialog";
import { DocumentLinkPickerDialog } from "@/components/editor/document-link-picker-dialog";
import { SidebarInset, SidebarProvider } from "@repo/ui";
import { auth } from "../(auth)/auth";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  return (
    <>
      <WorkspaceProvider>
        <DataStreamProvider>
          <SidebarProvider defaultOpen={!isCollapsed}>
            <AppSidebar user={session?.user} />
            <SidebarInset>
              {children}
              <MaterialLibraryDialog />
              <DocumentLinkPickerDialog />
            </SidebarInset>
          </SidebarProvider>
        </DataStreamProvider>
      </WorkspaceProvider>
    </>
  );
}
