import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type ModelMessage } from "ai";

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
 * ModelScope OpenAI 兼容网关 + AI SDK `streamText`（聚合流式正文）。
 * 未配置 `MODELSCOPE_API_KEY` 时返回 `null`（由调用方决定错误处理）。
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

  const result = await streamText({
    model: provider(modelId),
    ...("messages" in params
      ? { messages: params.messages }
      : { system: params.system, prompt: params.prompt }),
    temperature,
  });

  return (await result.text).trim();
}
