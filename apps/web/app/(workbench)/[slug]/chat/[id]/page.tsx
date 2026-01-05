import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@repo/ai";
import { getChatById, getMessagesByChatId } from "@repo/database";
import { convertToUIMessages } from "@/lib/utils";
import { requireWorkspaceAccess } from "@/lib/workspace-access";

export default async function Page(props: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const params = await props.params;
  const { slug, id } = params;

  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // 验证用户对该空间的访问权限
  const { workspaceId } = (await requireWorkspaceAccess(slug))!;

  const chat = await getChatById({ id });
  if (!chat) {
    notFound();
  }

  // 聊天现在都是私有的，只有所有者可以使用
  // 但如果是工作空间内的聊天，成员应该可以查看?
  // 按照目前逻辑，如果 chat.workspaceId 匹配当前 workspaceId，则允许访问
  const isOwner = session.user.id === chat.userId;
  const isWorkspaceChat = chat.workspaceId === workspaceId;

  if (!isOwner && !isWorkspaceChat) {
    return notFound();
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          autoResume={true}
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialLastContext={chat.lastContext ?? undefined}
          initialMessages={uiMessages}
          isReadonly={session?.user?.id !== chat.userId}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={chatModelFromCookie.value}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        isReadonly={session?.user?.id !== chat.userId}
      />
      <DataStreamHandler />
    </>
  );
}
