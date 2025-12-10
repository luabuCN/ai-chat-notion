import "server-only";


import { ChatSDKError } from "./errors";
import type { AppUsage } from "./usage";
import { generateUUID } from "./utils";
import { prisma } from "./client";
import { generateHashedPassword } from "./password";
import type { VisibilityType, ArtifactKind } from "./types";

// Types
export type User = {
  id: string;
  email: string;
  password: string | null;
};

export type Chat = {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  visibility: string;
  lastContext: AppUsage | null;
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  createdAt: Date;
  title: string;
  content: string | null;
  kind: string;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};

export type Stream = {
  id: string;
  chatId: string;
  createdAt: Date;
};

export type EditorDocument = {
  id: string;
  title: string;
  content: string | null;
  userId: string;
  parentDocumentId: string | null;
  coverImage: string | null;
  coverImageType: string | null;
  isPublished: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getUser(email: string): Promise<User[]> {
  try {
    return await prisma.user.findMany({
      where: { email },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await prisma.user.create({
      data: { email, password: hashedPassword },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return [
      await prisma.user.create({
        data: { email, password },
        select: { id: true, email: true },
      }),
    ];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await prisma.chat.create({
      data: {
        id,
        createdAt: new Date(),
        userId,
        title,
        visibility,
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
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    let filteredChats: Chat[] = [];

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
          userId: id,
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
          userId: id,
          createdAt: { lt: selectedChat.createdAt },
        },
        orderBy: { createdAt: "desc" },
        take: extendedLimit,
      })) as Chat[];
    } else {
      filteredChats = (await prisma.chat.findMany({
        where: { userId: id },
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

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const existingVote = await prisma.vote.findUnique({
      where: {
        chatId_messageId: { chatId, messageId },
      },
    });

    if (existingVote) {
      return await prisma.vote.update({
        where: {
          chatId_messageId: { chatId, messageId },
        },
        data: { isUpvoted: type === "up" },
      });
    }
    return await prisma.vote.create({
      data: {
        chatId,
        messageId,
        isUpvoted: type === "up",
      },
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await prisma.vote.findMany({
      where: { chatId: id },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return [
      await prisma.document.create({
        data: {
          id,
          title,
          kind,
          content,
          userId,
          createdAt: new Date(),
        },
      }),
    ];
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    return await prisma.document.findMany({
      where: { id },
      orderBy: { createdAt: "asc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const documents = await prisma.document.findMany({
      where: { id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    return documents[0] || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await prisma.suggestion.deleteMany({
      where: {
        documentId: id,
        documentCreatedAt: { gt: timestamp },
      },
    });

    return await prisma.document.deleteMany({
      where: {
        id,
        createdAt: { gt: timestamp },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function getDocumentsByUserId({ userId }: { userId: string }) {
  try {
    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // 获取每个文档的最新版本（按 id 分组，取最新的 createdAt）
    const latestDocuments = documents.reduce(
      (acc: Document[], doc: Document) => {
        const existing = acc.find((d: Document) => d.id === doc.id);
        if (!existing || doc.createdAt > existing.createdAt) {
          return [...acc.filter((d: Document) => d.id !== doc.id), doc];
        }
        return acc;
      },
      [] as Document[]
    );

    return latestDocuments;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by user id"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await prisma.suggestion.createMany({
      data: suggestions,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await prisma.suggestion.findMany({
      where: { documentId },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
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

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await prisma.chat.update({
      where: { id: chatId },
      data: { visibility },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
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

    const count = await prisma.message.count({
      where: {
        chat: { userId: id },
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

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await prisma.stream.create({
      data: { id: streamId, chatId, createdAt: new Date() },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streams = await prisma.stream.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    return streams.map(({ id }: { id: string }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// EditorDocument 相关查询函数

export async function createEditorDocument({
  title,
  content,
  userId,
  parentDocumentId,
  coverImage,
  coverImageType,
}: {
  title: string;
  content?: string;
  userId: string;
  parentDocumentId?: string | null;
  coverImage?: string | null;
  coverImageType?: "color" | "url" | null;
}) {
  try {
    return await prisma.editorDocument.create({
      data: {
        title,
        content: content ?? "",
        userId,
        parentDocumentId: parentDocumentId ?? null,
        coverImage: coverImage ?? null,
        coverImageType: coverImageType ?? "url",
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create editor document"
    );
  }
}

export async function getEditorDocumentById({ id }: { id: string }) {
  try {
    const document = await prisma.editorDocument.findUnique({
      where: { id },
    });

    if (!document) {
      throw new ChatSDKError(
        "not_found:database",
        `Editor document with id ${id} not found`
      );
    }

    return document as EditorDocument;
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get editor document by id"
    );
  }
}

export async function getEditorDocumentsByUserId({
  userId,
  parentDocumentId,
  includeDeleted = false,
}: {
  userId: string;
  parentDocumentId?: string | null;
  includeDeleted?: boolean;
}) {
  try {
    const where: {
      userId: string;
      parentDocumentId: string | null | undefined;
      deletedAt: Date | null | undefined;
    } = {
      userId,
      parentDocumentId: parentDocumentId ?? null,
      deletedAt: includeDeleted ? undefined : null,
    };

    return await prisma.editorDocument.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get editor documents by user id"
    );
  }
}

export async function updateEditorDocument({
  id,
  title,
  content,
  coverImage,
  coverImageType,
  isPublished,
}: {
  id: string;
  title?: string;
  content?: string;
  coverImage?: string | null;
  coverImageType?: "color" | "url" | null;
  isPublished?: boolean;
}) {
  try {
    const updateData: {
      title?: string;
      content?: string;
      coverImage?: string | null;
      coverImageType?: string | null;
      isPublished?: boolean;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (coverImageType !== undefined) updateData.coverImageType = coverImageType;
    if (isPublished !== undefined) updateData.isPublished = isPublished;

    return await prisma.editorDocument.update({
      where: { id },
      data: updateData,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update editor document"
    );
  }
}

export async function softDeleteEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to soft delete editor document"
    );
  }
}

export async function restoreEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { deletedAt: null },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to restore editor document"
    );
  }
}

export async function deleteEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.delete({
      where: { id },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete editor document"
    );
  }
}

export async function publishEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { isPublished: true },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to publish editor document"
    );
  }
}

export async function unpublishEditorDocument({ id }: { id: string }) {
  try {
    return await prisma.editorDocument.update({
      where: { id },
      data: { isPublished: false },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to unpublish editor document"
    );
  }
}
