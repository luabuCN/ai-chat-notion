import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
  type LanguageModel,
} from "ai";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { differenceInSeconds } from "date-fns";
import { generateText } from "ai";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getChatTitle,
  getEditorDocumentById,
  getMessagesByChatId,
  getStreamIdsByChatId,
  getWorkspaceBySlug,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  updateChatTitleById,
} from "@repo/database";
import type { Chat, DBMessage } from "@repo/database";
import {
  getFirstModelSlug,
  getProviderWithModel,
  systemPrompt,
  titlePrompt,
  type RequestHints,
} from "@repo/ai";
import type { Context } from "hono";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import {
  convertToUIMessages,
  formatChatStreamError,
  generateUUID,
  getTextFromMessage,
  hasAssistantMessageContent,
} from "../../../shared/utils.js";
import type { ChatMessage } from "../../../shared/types.js";
import { createDocument } from "../../ai/tools/create-document.js";
import { getWeather } from "../../ai/tools/get-weather.js";
import { requestSuggestions } from "../../ai/tools/request-suggestions.js";
import { updateDocument } from "../../ai/tools/update-document.js";
import { viewDocument } from "../../ai/tools/view-document.js";
import { postRequestBodySchema, type PostRequestBody } from "./schema.js";

let globalStreamContext: ResumableStreamContext | null = null;

function isMoonshotThinkingModel(modelSlug: string): boolean {
  return modelSlug.toLowerCase().includes("thinking");
}

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("REDIS_URL")) {
        console.log(" > Resumable streams are disabled due to missing REDIS_URL");
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

function fallbackTitleFromMessage(message: ChatMessage): string {
  const text = getTextFromMessage(message).trim().replace(/\s+/g, " ");
  if (!text) {
    return "新对话";
  }
  return text.length > 20 ? `${text.slice(0, 20)}…` : text;
}

async function generateTitleFromUserMessage({
  message,
  modelSlug,
}: {
  message: ChatMessage;
  modelSlug: string;
}) {
  // 标题生成只是锦上添花，失败时绝不能阻断对话本身。
  try {
    const { text: title } = await generateText({
      model: getProviderWithModel(modelSlug),
      system: titlePrompt,
      prompt: getTextFromMessage(message),
    });

    const trimmed = title.trim();
    return trimmed.length > 0 ? trimmed : fallbackTitleFromMessage(message);
  } catch (error) {
    console.warn("Title generation failed, using fallback title:", error);
    return fallbackTitleFromMessage(message);
  }
}

export async function postChatHandler(c: Context) {
  let requestBody: PostRequestBody;

  try {
    const json = await c.req.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.log("chat request parse error", error);
    return new ApiError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedModelSlug,
      enableReasoning,
      modelCapabilities,
      workspaceSlug,
      documentIds,
      seedMessages,
    } = requestBody;

    const session = await getSessionFromRequest(c.req.raw);
    if (!session) {
      return new ApiError("unauthorized:chat").toResponse();
    }

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let seedBatchBaseMs: number | undefined;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ApiError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      const seedUserForTitle = seedMessages?.find((m) => m.role === "user");
      const messageForTitleGeneration: ChatMessage =
        seedUserForTitle !== undefined
          ? {
              id: seedUserForTitle.id,
              parts: seedUserForTitle.parts as ChatMessage["parts"],
              role: "user",
            }
          : (message as ChatMessage);

      let workspaceId: string | undefined;
      if (workspaceSlug) {
        const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
        if (workspace) {
          workspaceId = workspace.id;
        }
      }

      // 先用兜底标题秒建会话，避免标题生成的耗时/失败阻塞对话流。
      await saveChat({
        id,
        userId: session.user.id,
        title: fallbackTitleFromMessage(messageForTitleGeneration),
        workspaceId,
      });

      // 标题生成放到后台异步执行，成功后再更新；失败也不影响对话。
      void (async () => {
        try {
          const titleModelSlug =
            selectedModelSlug || (await getFirstModelSlug());
          const title = await generateTitleFromUserMessage({
            message: messageForTitleGeneration,
            modelSlug: titleModelSlug,
          });
          await updateChatTitleById({ chatId: id, title });
        } catch (err) {
          console.warn("Background title generation failed for chat", id, err);
        }
      })();
    }

    if (messagesFromDb.length === 0 && seedMessages?.length) {
      const seedT0 = Date.now();
      seedBatchBaseMs = seedT0;
      await saveMessages({
        messages: seedMessages.map((m, i) => ({
          attachments: [],
          chatId: id,
          createdAt: new Date(seedT0 + i * 1000),
          id: m.id,
          parts: m.parts,
          role: m.role,
        })),
      });
      messagesFromDb = await getMessagesByChatId({ id });
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message as ChatMessage];
    const sanitizedMessages = uiMessages.map((msg) => {
      if (msg.role === "assistant") {
        const parts = msg.parts || [];
        const hasTextPart = parts.some(
          (part) => part.type === "text" && part.text?.trim(),
        );
        const hasToolParts = parts.some((part) => part.type.startsWith("tool-"));

        if (hasToolParts && !hasTextPart && parts.length > 0) {
          return {
            ...msg,
            parts: [
              ...parts,
              {
                type: "text" as const,
                text: "Tool call completed.",
              },
            ],
          };
        }
      }
      return msg;
    });

    const requestHints: RequestHints = {
      latitude: undefined,
      longitude: undefined,
      city: undefined,
      country: undefined,
    };
    let documentContext = "";
    const documentAttachments: Array<{
      type: string;
      id: string;
      title: string;
      icon: string | null;
    }> = [];
    const MAX_DOCUMENT_CONTEXT_CHARS = 12_000;

    if (documentIds && documentIds.length > 0) {
      const docs = await Promise.all(
        documentIds.map(async (docId) => {
          try {
            return await getEditorDocumentById({ id: docId });
          } catch {
            return null;
          }
        }),
      );

      const validDocs = docs.filter(Boolean);
      if (validDocs.length > 0) {
        let totalChars = 0;
        const truncatedParts: string[] = [];

        for (const doc of validDocs) {
          const content = doc!.content || "(Empty document)";
          const available = MAX_DOCUMENT_CONTEXT_CHARS - totalChars;
          if (available <= 0) {
            break;
          }

          const truncated =
            content.length > available
              ? `${content.slice(0, available)}\n...(Content truncated)`
              : content;

          truncatedParts.push(
            `<reference_document id="${doc!.id}" title="${doc!.title}">\n${truncated}\n</reference_document>`,
          );
          totalChars += truncated.length;

          documentAttachments.push({
            type: "document-reference",
            id: doc!.id,
            title: doc!.title,
            icon: doc!.icon,
          });
        }

        documentContext = truncatedParts.join("\n\n");
      }
    }

    const incomingUserCreatedAt =
      seedBatchBaseMs !== undefined && seedMessages?.length
        ? new Date(seedBatchBaseMs + seedMessages.length * 1000 + 1000)
        : new Date();

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: documentAttachments,
          createdAt: incomingUserCreatedAt,
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage:
      | Parameters<typeof updateChatLastContextById>[0]["context"]
      | undefined;
    const modelSlug = selectedModelSlug || (await getFirstModelSlug());
    const modelProvider = getProviderWithModel(
      modelSlug,
    ) as unknown as LanguageModel;
    const supportsReasoning =
      modelCapabilities?.supports_reasoning ?? isMoonshotThinkingModel(modelSlug);
    const reasoningEnabled = Boolean(enableReasoning && supportsReasoning);

    const sysPrompt = systemPrompt({
      enableReasoning,
      requestHints,
      documentContext,
    });

    const modelMessages = await convertToModelMessages(sanitizedMessages);

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: modelProvider,
          system: sysPrompt,
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          maxOutputTokens: 5000,
          experimental_activeTools: [
            "getWeather",
            "createDocument",
            "updateDocument",
            "requestSuggestions",
            "viewDocument",
          ],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getWeather,
            viewDocument,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({ session, dataStream }),
          },
          experimental_telemetry: {
            isEnabled: false,
            functionId: "stream-text",
          },
          ...(reasoningEnabled && {
            providerOptions: {
              moonshotai: {
                thinking: { type: "enabled", budgetTokens: 4096 },
                reasoningHistory: "interleaved",
              },
            },
          }),
          onFinish: async ({ usage }) => {
            finalMergedUsage = usage;
            dataStream.write({ type: "data-usage", data: finalMergedUsage });
          },
        });

        result.consumeStream();
        dataStream.merge(result.toUIMessageStream({ sendReasoning: reasoningEnabled }));
      },
      generateId: generateUUID,
      onFinish: async ({ messages, responseMessage }) => {
        if (
          responseMessage.role === "assistant" &&
          !hasAssistantMessageContent(responseMessage)
        ) {
          return;
        }

        await saveMessages({
          messages: messages.map((currentMessage) => ({
            id: currentMessage.id,
            role: currentMessage.role,
            parts: currentMessage.parts,
            createdAt: new Date(),
            attachments: [],
            chatId: id,
          })),
        });

        if (finalMergedUsage) {
          try {
            await updateChatLastContextById({
              chatId: id,
              context: finalMergedUsage,
            });
          } catch (err) {
            console.warn("Unable to persist last usage for chat", id, err);
          }
        }
      },
      onError: (error) => {
        console.error("stream error:", error);
        return formatChatStreamError(error);
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    if (error instanceof ApiError) {
      return error.toResponse();
    }
    console.error("Unhandled error in chat API:", error);
    return new ApiError("offline:chat").toResponse();
  }
}

export async function deleteChatHandler(c: Context) {
  const id = new URL(c.req.url).searchParams.get("id");

  if (!id) {
    return new ApiError("bad_request:api").toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });
  if (chat?.userId !== session.user.id) {
    return new ApiError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });
  return c.json(deletedChat);
}

export async function getChatHandler(c: Context) {
  const id = c.req.param("id");

  if (!id) {
    return new ApiError("bad_request:api").toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });
  if (!chat) {
    return c.text("Chat not found", 404);
  }

  if (chat.userId !== session.user.id) {
    return new ApiError("forbidden:chat").toResponse();
  }

  return c.json(chat);
}

export async function getChatMessagesHandler(c: Context) {
  const id = c.req.param("id");

  if (!id) {
    return new ApiError("bad_request:api").toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });
  if (!chat) {
    return new ApiError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ApiError("forbidden:chat").toResponse();
  }

  const messages = await getMessagesByChatId({ id });
  return c.json({ chatId: id, messages: convertToUIMessages(messages) });
}

export async function getChatTitleHandler(c: Context) {
  const id = c.req.param("id");

  if (!id) {
    return new ApiError("bad_request:api").toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  const chat = await getChatTitle({ id });
  if (!chat) {
    return c.text("Chat not found", 404);
  }

  if (chat.userId !== session.user.id) {
    return new ApiError("forbidden:chat").toResponse();
  }

  return c.json({ title: chat.title });
}

export async function getChatStreamHandler(c: Context) {
  const chatId = c.req.param("id");
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ApiError("bad_request:api").toResponse();
  }

  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:chat").toResponse();
  }

  let chat: Chat | null;
  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ApiError("not_found:chat").toResponse();
  }

  if (!chat) {
    return new ApiError("not_found:chat").toResponse();
  }

  if (chat.userId !== session.user.id) {
    return new ApiError("forbidden:chat").toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });
  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ApiError("not_found:stream").toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(recentStreamId, () =>
    emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
  );

  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage || mostRecentMessage.role !== "assistant") {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);
    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: "data-appendMessage",
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return new Response(
      restoredStream.pipeThrough(new JsonToSseTransformStream()),
      { status: 200 },
    );
  }

  return new Response(stream, { status: 200 });
}
