import { Toaster } from "sonner";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorContent } from "@/components/editor/editor-content";
import { getUserLocale } from "@/i18n/service";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getUserLocale();
  const { id } = await params;

  return (
    <div className="relative h-screen flex-1 flex flex-col bg-background">
      <EditorHeader locale={locale} />

      <div className="flex-1 overflow-auto">
        <EditorContent locale={locale} documentId={id} />
      </div>
      <Toaster />
    </div>
  );
}
