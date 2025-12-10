import { Toaster } from "sonner";
import { EditorHeaderWrapper } from "@/components/editor/editor-header-wrapper";
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
      <EditorHeaderWrapper locale={locale} documentId={id} />

      <div className="flex-1 overflow-auto">
        <EditorContent locale={locale} documentId={id} />
      </div>
      <Toaster />
    </div>
  );
}
