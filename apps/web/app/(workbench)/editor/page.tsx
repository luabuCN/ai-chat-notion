"use client";

import { Toaster } from "sonner";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@repo/ui";
import { useWindowSize } from "usehooks-ts";

import { Editor } from "@repo/editor";

export default function Page() {
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();

  return (
    <div className="relative h-screen flex-1 flex flex-col">
      {(!open || windowWidth < 768) && (
        <SidebarToggle
          className="absolute left-1 top-12 z-9999999"
          variant="ghost"
        />
      )}
      <div className="w-full h-full p-4 overflow-auto">
        <Editor className="min-h-full" />
      </div>
      <Toaster />
    </div>
  );
}
