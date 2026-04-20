"use client";

import dynamic from "next/dynamic";
import { EditorBodyLoadingSkeleton } from "@/components/editor/editor-loading-skeleton";

export const PreviewEditorClient = dynamic(
  () =>
    import("@/components/editor/unified-editor-client").then(
      (m) => m.UnifiedEditorClient
    ),
  {
    ssr: false,
    loading: () => <EditorBodyLoadingSkeleton />,
  }
);