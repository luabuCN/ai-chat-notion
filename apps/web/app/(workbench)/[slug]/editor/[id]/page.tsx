import { EditorPageClient } from "@/components/editor/editor-page-client";
import { getUserLocale } from "@/i18n/service";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { auth } from "@/app/(auth)/auth";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  // 验证用户对该空间的访问权限
  await requireWorkspaceAccess(slug);

  const [locale, session] = await Promise.all([getUserLocale(), auth()]);

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
