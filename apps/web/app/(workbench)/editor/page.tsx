"use client";

import { useMemo } from "react";
import { Toaster } from "sonner";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { useSidebar } from "@repo/ui";
import { useWindowSize } from "usehooks-ts";
import dynamic from "next/dynamic";

const BlockNoteEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.NoteEditor),
  { ssr: false }
);

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
        <BlockNoteEditor />
      </div>
      <Toaster />
    </div>
  );
}
