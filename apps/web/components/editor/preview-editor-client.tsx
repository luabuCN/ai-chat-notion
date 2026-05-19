"use client";

import dynamic from "next/dynamic";
import { EditorBodyLoadingSkeleton } from "@/components/editor/editor-loading-skeleton";

export const PreviewEditorClient = dynamic(
  () =>
    import("@/components/editor/tiptap-editor-client").then(
      (m) => m.TiptapEditorClient
    ),
  {
    ssr: false,
    loading: () => <EditorBodyLoadingSkeleton />,
  }
);