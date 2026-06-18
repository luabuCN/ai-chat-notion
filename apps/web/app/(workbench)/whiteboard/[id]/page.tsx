import { WhiteboardPageClient } from "@/components/whiteboard/whiteboard-page-client";
import { auth } from "@/app/(auth)/auth";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
