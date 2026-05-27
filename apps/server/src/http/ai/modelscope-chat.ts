import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, streamText, type ModelMessage } from "ai";

const MODELSCOPE_BASE_URL = "https://api-inference.modelscope.cn/v1";

export const DEFAULT_MODELSCOPE_MODEL = "Qwen/Qwen3-8B";

function getModelscopeProvider() {
  const apiKey = process.env.MODELSCOPE_API_KEY;
  if (!apiKey) {
    return null;
  }
  return createOpenAICompatible({
    name: "modelscope-inference",
    baseURL: MODELSCOPE_BASE_URL,
    apiKey,
    transformRequestBody: (body: Record<string, unknown>) => ({
      ...body,
      enable_thinking: false,
    }),
  });
}

export type ModelScopeChatParams =
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
 * ModelScope OpenAI 兼容网关 + `generateText`（非流式，避免流式兼容层返回空正文）。
 * 未配置 `MODELSCOPE_API_KEY` 时返回 `null`。
 */
export async function runModelScopeChat(
  params: ModelScopeChatParams
): Promise<string | null> {
  const provider = getModelscopeProvider();
  if (!provider) {
    return null;
  }

  const modelId =
    "model" in params && params.model
      ? params.model
      : DEFAULT_MODELSCOPE_MODEL;
  const temperature = params.temperature ?? 0.1;

  try {
    const result = await generateText({
      model: provider(modelId),
      ...("messages" in params
        ? { messages: params.messages }
        : { system: params.system, prompt: params.prompt }),
      temperature,
    });

    return result.text.trim();
  } catch (error) {
    const message = formatModelScopeFailure(error);
    throw new Error(message);
  }
}

function formatModelScopeFailure(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.trim().length > 0) {
      return error.message;
    }
  }
  return "ModelScope 接口调用失败，请检查密钥、模型名与网络";
}

/**
 * 流式调用（供 `/api/ai/openai` 的 `stream: true` 使用）。
 * 未配置密钥时返回 `null`。
 */
export function streamModelScopeChat(
  params: ModelScopeChatParams,
): ReturnType<typeof streamText> | null {
  const provider = getModelscopeProvider();
  if (!provider) {
    return null;
  }

  const modelId =
    "model" in params && params.model
      ? params.model
      : DEFAULT_MODELSCOPE_MODEL;
  const temperature = params.temperature ?? 0.1;

  return streamText({
    model: provider(modelId),
    ...("messages" in params
      ? { messages: params.messages }
      : { system: params.system, prompt: params.prompt }),
    temperature,
  });
}
