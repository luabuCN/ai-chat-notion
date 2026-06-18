"use client";

import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePublishedDocumentPreview } from "@/hooks/use-document-query";
import "@repo/whiteboard/styles";

const WhiteboardPreview = dynamic(
  () => import("@repo/whiteboard").then((mod) => mod.WhiteboardPreview),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-muted/30" aria-hidden />
    ),
  }
);

function mapLocaleToExcalidraw(locale: string): string {
  if (locale === "zh" || locale.startsWith("zh")) {
    return "zh-CN";
  }
  return "en";
}

interface PreviewWhiteboardClientProps {
  documentId: string;
}

export function PreviewWhiteboardClient({
  documentId,
}: PreviewWhiteboardClientProps) {
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data, isLoading, isError } = usePublishedDocumentPreview(documentId);

  useEffect(() => {
    setMounted(true);
  }, []);

  const excalidrawTheme = resolvedTheme === "dark" ? "dark" : "light";
  const langCode = mapLocaleToExcalidraw(locale);
  const readyToRender = mounted && resolvedTheme !== undefined;

  if (isLoading || !readyToRender) {
    return (
      <div className="relative h-full min-h-0 flex-1">
        <div className="h-full w-full animate-pulse bg-muted/30" aria-hidden />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
        无法加载白板内容
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 flex-1">
      <WhiteboardPreview
        key={`${documentId}:${data.yjsState?.length ?? 0}`}
        yjsStateB64={data.yjsState}
        mode="page"
        className="h-full w-full"
        theme={excalidrawTheme}
        langCode={langCode}
      />
    </div>
  );
}
