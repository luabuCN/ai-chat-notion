import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
  type LanguageModel,
} from "ai";
import { after } from "next/server";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { type RequestHints, systemPrompt } from "@repo/ai";
import { getProviderWithModel, getFirstModelSlug } from "@repo/ai";
import { createDocument } from "@/lib/ai/tools/create-document";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { viewDocument } from "@/lib/ai/tools/view-document";
import { isProductionEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getEditorDocumentById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  getWorkspaceBySlug,
} from "@repo/database";
import type { DBMessage } from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../(workbench)/chat/actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function isMoonshotThinkingModel(modelSlug: string): boolean {
  const normalizedModelSlug = modelSlug.toLowerCase();
  return normalizedModelSlug.includes("thinking");
}

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes("REDIS_URL")) {
        console.log(
          " > Resumable streams are disabled due to missing REDIS_URL"
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    console.log("error", _);

    return new ChatSDKError("bad_request:api").toResponse();
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
    }: {
      id: string;
      message: ChatMessage;
      selectedModelSlug?: string;
      enableReasoning?: boolean;
      modelCapabilities?: {
        supports_image_in?: boolean;
        supports_video_in?: boolean;
        supports_reasoning?: boolean;
      };
      workspaceSlug?: string;
      documentIds?: string[];
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    // 所有已登录用户为 regular 类型
    const userType: UserType = "regular";

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      // Only fetch messages if chat already exists
      messagesFromDb = await getMessagesByChatId({ id });
    } else {
      // Use custom model if provided, otherwise use first available model
      const titleModelSlug = selectedModelSlug || (await getFirstModelSlug());
      const title = await generateTitleFromUserMessage({
        message,
        modelSlug: titleModelSlug,
      });

      // 获取 workspace ID
      let workspaceId: string | undefined;
      if (workspaceSlug) {
        const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });
        if (workspace) {
          workspaceId = workspace.id;
        }
      }

      await saveChat({
        id,
        userId: session.user.id,
        title,
        workspaceId,
      });
      // New chat - no need to fetch messages, it's empty
    }

    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    // 确保每个 assistant 消息至少有一个非空的文本部分
    // 防止 convertToModelMessages 产生空文本字段导致 API 报错
    const sanitizedMessages = uiMessages.map((msg) => {
      if (msg.role === "assistant") {
        const parts = msg.parts || [];
        console.log(JSON.stringify(parts), "parts");

        const hasTextPart = parts.some(
          (part) => part.type === "text" && part.text?.trim()
        );
        const hasToolParts = parts.some((part) =>
          part.type.startsWith("tool-")
        );

        // 如果只有工具调用而没有文本内容，添加一个占位符文本
        // 这确保 convertToModelMessages 不会创建空的 text 字段
        if (hasToolParts && !hasTextPart && parts.length > 0) {
          return {
            ...msg,
            parts: [
              ...parts,
              {
                type: "text" as const,
                text: "工具调用已完成。", // 添加占位符文本，避免空文本字段
              },
            ],
          };
        }
      }
      return msg;
    });

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    // 获取引用文档的内容，构建文档上下文
    let documentContext = "";
    // 保存引用文档的元信息，用于前端显示
    const documentAttachments: Array<{
      type: string;
      id: string;
      title: string;
      icon: string | null;
    }> = [];

    if (documentIds && documentIds.length > 0) {
      const docs = await Promise.all(
        documentIds.map(async (docId) => {
          try {
            return await getEditorDocumentById({ id: docId });
          } catch {
            return null;
          }
        })
      );

      const validDocs = docs.filter(Boolean);
      if (validDocs.length > 0) {
        documentContext = validDocs
          .map(
            (doc) =>
              `<reference_document title="${doc!.title}">\n${
                doc!.content || "(空文档)"
              }\n</reference_document>`
          )
          .join("\n\n");

        // 收集文档元信息
        for (const doc of validDocs) {
          documentAttachments.push({
            type: "document-reference",
            id: doc!.id,
            title: doc!.title,
            icon: doc!.icon,
          });
        }
      }
    }

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts,
          attachments: documentAttachments,
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    let finalMergedUsage: AppUsage | undefined;

    // Use custom model if provided, otherwise use first available model
    const modelSlug = selectedModelSlug || (await getFirstModelSlug());
    const modelProvider = getProviderWithModel(
      modelSlug
    ) as unknown as LanguageModel;

    const supportsReasoningFromClient = modelCapabilities?.supports_reasoning;
    const supportsReasoning =
      supportsReasoningFromClient ?? isMoonshotThinkingModel(modelSlug);
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
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
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

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: reasoningEnabled,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
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
        console.log("error", error);
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
