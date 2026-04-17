"use client";

import dynamic from "next/dynamic";
import { EditorBodyLoadingSkeleton } from "@/components/editor/editor-loading-skeleton";

export const PreviewEditorClient = dynamic(
  () =>
    import("@/components/editor/editor-client").then((m) => m.EditorClient),
  {
    ssr: false,
    loading: () => <EditorBodyLoadingSkeleton />,
  }
);
