import { auth } from "@/app/(auth)/auth";
import { InviteAcceptClient } from "./invite-accept-client";

export default async function DocInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  return (
    <InviteAcceptClient
      token={token}
      isLoggedIn={!!session?.user}
      userEmail={session?.user?.email || undefined}
    />
  );
}

