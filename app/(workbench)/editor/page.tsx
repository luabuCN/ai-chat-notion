"use client";

import { Toaster } from "sonner";

import { PlateEditor } from "@/components/plate-editor";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@/components/ui/sidebar";
import { useWindowSize } from "usehooks-ts";

export default function Page() {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  return (
    <div className="relative h-screen w-full">
      {(!open || windowWidth < 768) && (
        <SidebarToggle
          className="absolute left-1 top-12 z-9999999"
          variant="ghost"
        />
      )}
      <PlateEditor />
      <Toaster />
    </div>
  );
}
