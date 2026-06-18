import { WhiteboardPageClient } from "@/components/whiteboard/whiteboard-page-client";
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
  await requireWorkspaceAccess(slug);
  const session = await auth();

  return (
    <WhiteboardPageClient
      documentId={id}
      userId={session?.user?.id}
      userName={session?.user?.name || undefined}
      userEmail={session?.user?.email || undefined}
      userAvatarUrl={session?.user?.avatarUrl ?? undefined}
    />
  );
}
