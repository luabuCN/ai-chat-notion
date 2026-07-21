import { DEFAULT_CHAT_MODEL, getProviderWithModel } from "@repo/ai";
import {
  generateText,
  streamText,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import type { Context } from "hono";
import { completionRequestSchema } from "./schema.js";

// ─── Moonshot 非流式调用（供 PDF 润色等内部服务使用） ───────────────────────

export type MoonshotChatParams =
  | {
      system?: string;
      prompt: string;
      temperature?: number;
      model?: string;
    }
  | {
      messages: ModelMessage[];
      temperature?: number;
      model?: string;
    };

/**
 * Moonshot（AI SDK `@ai-sdk/moonshotai`）非流式调用。
 * 未配置 `API_KEY` 时返回 `null`。
 */
export async function runMoonshotChat(
  params: MoonshotChatParams,
): Promise<string | null> {
  if (!process.env.API_KEY?.trim()) {
    return null;
  }

  const modelId =
    "model" in params && params.model ? params.model : DEFAULT_CHAT_MODEL;
  const temperature = params.temperature ?? 0.1;

  try {
    const result = await generateText({
      model: getProviderWithModel(modelId),
      ...("messages" in params
        ? { messages: params.messages }
        : { system: params.system, prompt: params.prompt }),
      temperature,
    });

    return result.text.trim();
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Moonshot 接口调用失败，请检查 API_KEY、模型名与网络";
    throw new Error(message);
  }
}

// ─── 路由 Handler ─────────────────────────────────────────────────────────────

export async function completionHandler(c: Context) {
  try {
    const json = await c.req.json();
    const parsed = completionRequestSchema.safeParse(json);

    if (!parsed.success) {
      return c.text("Missing prompt or messages", 400);
    }

    const {
      prompt,
      messages,
      system: overrideSystem,
      temperature,
    } = parsed.data;

    if (!prompt && (!messages || messages.length === 0)) {
      return c.text("Missing prompt or messages", 400);
    }

    const model = getProviderWithModel(
      "moonshot-v1-8k",
    ) as unknown as LanguageModel;

    const result = streamText({
      model,
      ...(messages
        ? { messages: messages as ModelMessage[] }
        : { prompt: prompt as string }),
      system:
        overrideSystem ||
        "You are a helpful assistant. Please answer the question directly without using a thinking tone. Answer in the language used by the user.",
      maxOutputTokens: 1024,
      temperature,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI completion error:", error);
    return c.text("AI completion failed", 500);
  }
}
