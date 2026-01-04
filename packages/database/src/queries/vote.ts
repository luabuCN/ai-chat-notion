import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";

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
