import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { DBMessage } from "./types";

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await prisma.message.createMany({
      data: messages.map((msg) => ({
        ...msg,
        parts: msg.parts as object,
        attachments: msg.attachments as object,
      })),
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await prisma.message.findMany({
      where: { chatId: id },
      orderBy: { createdAt: "asc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    const message = await prisma.message.findUnique({
      where: { id },
    });
    return message ? [message] : [];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await prisma.message.findMany({
      where: {
        chatId,
        createdAt: { gte: timestamp },
      },
      select: { id: true },
    });

    const messageIds = messagesToDelete.map((m: { id: string }) => m.id);

    if (messageIds.length > 0) {
      await prisma.vote.deleteMany({
        where: {
          chatId,
          messageId: { in: messageIds },
        },
      });

      return await prisma.message.deleteMany({
        where: {
          chatId,
          id: { in: messageIds },
        },
      });
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const chats = await prisma.chat.findMany({
      where: { userId: id },
      select: { id: true },
    });

    if (chats.length === 0) {
      return 0;
    }

    const chatIds = chats.map(({ id: chatId }: { id: string }) => chatId);

    const count = await prisma.message.count({
      where: {
        chatId: { in: chatIds },
        createdAt: { gte: twentyFourHoursAgo },
        role: "user",
      },
    });

    return count;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}
