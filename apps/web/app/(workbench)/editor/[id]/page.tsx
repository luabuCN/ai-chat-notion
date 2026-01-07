import { EditorHeaderWrapper } from "@/components/editor/editor-header-wrapper";
import { EditorContent } from "@/components/editor/editor-content";
import { getUserLocale } from "@/i18n/service";
import { auth } from "@/app/(auth)/auth";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [locale, session] = await Promise.all([getUserLocale(), auth()]);
  const { id } = await params;

  return (
    <div className="flex h-dvh min-w-0 flex-col bg-background overflow-hidden">
      <div className="flex-1 overflow-auto min-h-0">
        <div className="sticky top-0 z-49 bg-background shrink-0">
          <EditorHeaderWrapper
            locale={locale}
            documentId={id}
            currentUserId={session?.user?.id}
          />
        </div>
        <EditorContent
          locale={locale}
          documentId={id}
          userId={session?.user?.id}
          userName={session?.user?.name || undefined}
          userEmail={session?.user?.email || undefined}
        />
      </div>
    </div>
  );
}
