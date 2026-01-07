import { EditorPageClient } from "@/components/editor/editor-page-client";
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
    <EditorPageClient
      locale={locale}
      documentId={id}
      userId={session?.user?.id}
      userName={session?.user?.name || undefined}
      userEmail={session?.user?.email || undefined}
    />
  );
}
