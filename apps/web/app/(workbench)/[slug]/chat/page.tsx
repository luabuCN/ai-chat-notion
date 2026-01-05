import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@repo/ai";
import { generateUUID } from "@/lib/utils";
import { auth } from "../../../(auth)/auth";
import { requireWorkspaceAccess } from "@/lib/workspace-access";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const { slug } = await params;

  // 验证用户对该空间的访问权限
  await requireWorkspaceAccess(slug);

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");

  if (!modelIdFromCookie) {
    return (
      <>
        <Chat
          autoResume={false}
          id={id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialMessages={[]}
          isReadonly={false}
          key={id}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={modelIdFromCookie.value}
        initialMessages={[]}
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
