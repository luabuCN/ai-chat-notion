import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";

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
