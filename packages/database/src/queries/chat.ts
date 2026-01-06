import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { AppUsage } from "../usage";
import { Chat } from "./types";

export async function saveChat({
  id,
  userId,
  title,
  workspaceId,
}: {
  id: string;
  userId: string;
  title: string;
  workspaceId?: string;
}) {
  try {
    return await prisma.chat.create({
      data: {
        id,
        createdAt: new Date(),
        userId,
        title,
        workspaceId,
      },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await prisma.vote.deleteMany({ where: { chatId: id } });
    await prisma.message.deleteMany({ where: { chatId: id } });
    await prisma.stream.deleteMany({ where: { chatId: id } });

    return await prisma.chat.delete({
      where: { id },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await prisma.chat.findMany({
      where: { userId },
      select: { id: true },
    });

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c: { id: string }) => c.id);

    await prisma.vote.deleteMany({ where: { chatId: { in: chatIds } } });
    await prisma.message.deleteMany({ where: { chatId: { in: chatIds } } });
    await prisma.stream.deleteMany({ where: { chatId: { in: chatIds } } });

    const deletedChats = await prisma.chat.deleteMany({
      where: { userId },
    });

    return { deletedCount: deletedChats.count };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  workspaceId,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  workspaceId?: string | null;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    let filteredChats: Chat[] = [];

    // 构建查询条件
    // AI 对话始终只显示用户自己的聊天，不显示工作空间其他人的聊天
    const where: any = {
      userId: id, // 始终按用户 ID 过滤
    };

    // 如果指定了 workspaceId，则只显示该工作空间的聊天
    if (workspaceId) {
      where.workspaceId = workspaceId;
    } else if (workspaceId === null) {
      // 如果明确传入 null，则只显示不属于任何工作空间的聊天
      where.workspaceId = null;
    }

    if (startingAfter) {
      const selectedChat = await prisma.chat.findUnique({
        where: { id: startingAfter },
      });

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = (await prisma.chat.findMany({
        where: {
          ...where,
          createdAt: { gt: selectedChat.createdAt },
        },
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      })) as Chat[];
    } else if (endingBefore) {
      const selectedChat = await prisma.chat.findUnique({
        where: { id: endingBefore },
      });

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = (await prisma.chat.findMany({
        where: {
          ...where,
          createdAt: { lt: selectedChat.createdAt },
        },
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      })) as Chat[];
    } else {
      filteredChats = (await prisma.chat.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      })) as Chat[];
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const selectedChat = await prisma.chat.findUnique({
      where: { id },
    });

    return selectedChat as Chat | null;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function getChatTitle({ id }: { id: string }) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id },
      select: { title: true, userId: true },
    });

    return chat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat title");
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  context: AppUsage;
}) {
  try {
    return await prisma.chat.update({
      where: { id: chatId },
      data: { lastContext: context as unknown as object },
    });
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}
