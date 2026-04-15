import { EditorPageClient } from "@/components/editor/editor-page-client";
import { getUserLocale } from "@/i18n/service";
import { auth } from "@/app/(auth)/auth";
import { prisma } from "@repo/database";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const document = await prisma.editorDocument.findUnique({
    where: { id },
    select: { title: true, icon: true },
  });

  const titleText = document?.title?.trim() || "未命名";

  return {
    title: `${titleText} - 知作`,
    icons: document?.icon
      ? [
          {
            url: `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${document.icon}</text></svg>`,
          },
        ]
      : [{ url: "/favicon.ico" }],
  };
}

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
