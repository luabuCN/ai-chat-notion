import { notFound } from "next/navigation";
import { getEditorDocumentById } from "@repo/database";
import { EditorPageHeader } from "@/components/editor/editor-page-header";
import { PreviewEditorClient } from "@/components/editor/preview-editor-client";
import { PreviewWhiteboardClient } from "@/components/whiteboard/preview-whiteboard-client";
import { EditorScrollNav } from "@/components/editor/editor-scroll-nav";
import { PreviewThemeToggle } from "@/components/editor/preview-theme-toggle";
import { PenTool } from "lucide-react";
import type { Metadata } from "next";

interface PreviewPageProps {
  params: Promise<{
    documentId: string;
  }>;
}

export async function generateMetadata({
  params,
}: PreviewPageProps): Promise<Metadata> {
  const { documentId } = await params;
  try {
    const document = await getEditorDocumentById({ id: documentId });
    if (!document.isPublished) {
      return {
        title: "Private Document",
      };
    }
    const fallbackTitle =
      document.kind === "whiteboard" ? "未命名白板" : "Untitled";
    return {
      title: document.title?.trim() || fallbackTitle,
      description:
        document.kind === "whiteboard" ? "Shared whiteboard" : "Shared document",
      icons: {
        icon: document.icon ? undefined : "/favicon.ico",
      },
    };
  } catch {
    return {
      title: "Document Not Found",
    };
  }
}

export default async function PreviewPage({ params }: PreviewPageProps) {
  const { documentId } = await params;

  try {
    const document = await getEditorDocumentById({ id: documentId });

    if (!document.isPublished) {
      return notFound();
    }

    if (document.kind === "whiteboard") {
      const displayTitle = document.title?.trim() || "未命名白板";

      return (
        <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md text-lg">
              {document.icon ? (
                <span className="leading-none">{document.icon}</span>
              ) : (
                <PenTool className="size-4 text-muted-foreground" aria-hidden />
              )}
            </div>
            <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {displayTitle}
            </h1>
          </header>
          <PreviewWhiteboardClient documentId={documentId} />
          <PreviewThemeToggle />
        </div>
      );
    }

    return (
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        <div
          id="editor-scroll-container"
          className="min-h-0 flex-1 overflow-y-auto scroll-pb-20"
        >
          <EditorPageHeader
            initialTitle={document.title}
            initialIcon={document.icon}
            initialCover={document.coverImage}
            coverImageType={
              (document.coverImageType as "color" | "url") ?? "url"
            }
            coverPosition={document.coverImagePosition ?? 50}
            readonly
          />

          <div className="mx-auto max-w-4xl px-4 pb-20">
            <PreviewEditorClient
              initialContent={document.content ?? ""}
              readonly
            />
          </div>
        </div>
        <PreviewThemeToggle />
        <EditorScrollNav />
      </div>
    );
  } catch {
    return notFound();
  }
}
