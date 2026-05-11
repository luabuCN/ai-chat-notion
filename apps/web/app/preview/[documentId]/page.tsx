import { notFound } from "next/navigation";
import { getEditorDocumentById } from "@repo/database";
import { EditorPageHeader } from "@/components/editor/editor-page-header";
import { PreviewEditorClient } from "@/components/editor/preview-editor-client";
import { EditorScrollNav } from "@/components/editor/editor-scroll-nav";
import { PreviewThemeToggle } from "@/components/editor/preview-theme-toggle";
import { Metadata } from "next";

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
    return {
      title: document.title || "Untitled",
      description: "Shared document",
      icons: {
        icon: document.icon ? undefined : "/favicon.ico", // TODO: handle emoji icon as favicon if possible, or just default
      },
    };
  } catch (error) {
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

    return (
      <div className="flex h-dvh min-w-0 w-full flex-col bg-background">
        {/* 与编辑页共用 #editor-scroll-container，供 EditorScrollNav 与气泡菜单定位 */}
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
              documentId={documentId}
              initialContent={document.content ?? ""}
              readonly={true}
            />
          </div>
        </div>
        <PreviewThemeToggle />
        <EditorScrollNav />
      </div>
    );
  } catch (error) {
    return notFound();
  }
}
