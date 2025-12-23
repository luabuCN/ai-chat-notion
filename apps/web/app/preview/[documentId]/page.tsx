import { notFound } from "next/navigation";
import { getEditorDocumentById } from "@repo/database";
import { EditorClient } from "@/components/editor/editor-client";
import { EditorPageHeader } from "@/components/editor/editor-page-header";
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
      <div className="min-h-full bg-background">
        <EditorPageHeader
          initialTitle={document.title}
          initialIcon={document.icon}
          initialCover={document.coverImage}
          coverImageType={(document.coverImageType as "color" | "url") ?? "url"}
          coverPosition={document.coverImagePosition ?? 50}
          readonly
        />

        <div className="max-w-4xl mx-auto px-4 pb-20">
          <EditorClient initialContent={document.content} readonly={true} />
        </div>
      </div>
    );
  } catch (error) {
    return notFound();
  }
}
