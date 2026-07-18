import {
  DEFAULT_CHAT_MODEL,
  getProviderWithModel,
} from "@repo/ai";
import { generateText, streamText, type ModelMessage } from "ai";

function hasMoonshotApiKey(): boolean {
  return Boolean(process.env.API_KEY?.trim());
}

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
  params: MoonshotChatParams
): Promise<string | null> {
  if (!hasMoonshotApiKey()) {
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
    const message = formatMoonshotFailure(error);
    throw new Error(message);
  }
}

function formatMoonshotFailure(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Moonshot 接口调用失败，请检查 API_KEY、模型名与网络";
}

/**
 * 流式调用（供 `/api/ai/openai` 的 `stream: true` 使用）。
 * 未配置 `API_KEY` 时返回 `null`。
 */
export function streamMoonshotChat(
  params: MoonshotChatParams
): ReturnType<typeof streamText> | null {
  if (!hasMoonshotApiKey()) {
    return null;
  }

  const modelId =
    "model" in params && params.model ? params.model : DEFAULT_CHAT_MODEL;
  const temperature = params.temperature ?? 0.1;

  return streamText({
    model: getProviderWithModel(modelId),
    ...("messages" in params
      ? { messages: params.messages }
      : { system: params.system, prompt: params.prompt }),
    temperature,
  });
}
