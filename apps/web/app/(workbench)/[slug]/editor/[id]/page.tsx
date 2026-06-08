import { EditorPageClient } from "@/components/editor/editor-page-client";
import { getUserLocale } from "@/i18n/service";
import { requireWorkspaceAccess } from "@/lib/workspace-access";
import { auth } from "@/app/(auth)/auth";
import { prisma } from "@repo/database";
import { buildDocumentPageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const document = await prisma.editorDocument.findUnique({
    where: { id },
    select: { title: true, icon: true },
  });

  return buildDocumentPageMetadata(document);
}

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
      userAvatarUrl={session?.user?.avatarUrl ?? undefined}
    />
  );
}
