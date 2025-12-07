"use client";

import { Toaster } from "sonner";
import dynamic from "next/dynamic";
import { EditorHeader } from "@/components/editor-header";

const BlockNoteEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.NoteEditor),
  { ssr: false }
);

export default function Page() {
  return (
    <div className="relative h-screen flex-1 flex flex-col bg-background">
      <EditorHeader />

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto h-full">
          <BlockNoteEditor apiUrl="/api/blocknote-ai" />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
