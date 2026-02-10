"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { getProviderWithModel } from "@repo/ai";
import { titlePrompt } from "@repo/ai";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
} from "@repo/database";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
  modelSlug,
}: {
  message: UIMessage;
  modelSlug: string;
}) {
  // 不使用 system prompt，因为部分模型（如 gemma-3n）不支持 Developer instruction
  const { text: title } = await generateText({
    model: getProviderWithModel(modelSlug),
    prompt: `${titlePrompt}\n\n用户消息: ${getTextFromMessage(message)}`,
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}
