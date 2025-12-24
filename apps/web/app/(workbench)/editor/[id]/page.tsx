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
    <div className="flex h-dvh min-w-0 flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-auto min-h-0">
        <div className="sticky top-0 z-49 bg-background shrink-0">
          <EditorHeaderWrapper locale={locale} documentId={id} />
        </div>
        <EditorContent locale={locale} documentId={id} />
      </div>
    </div>
  );
}
