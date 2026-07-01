import OpenAI from "openai";
import type { Context } from "hono";
import type { ModelInfo } from "./schema.js";

/**
 * 静态 fallback 模型列表——当 Moonshot API 在中国境外不可达时使用。
 * Vercel 运行在 AWS/GCP 美区，无法连接 api.moonshot.cn（connect ETIMEDOUT）。
 */
const FALLBACK_MODELS: ModelInfo[] = [
  {
    provider: "moonshot",
    model: "moonshot-v1-8k",
    full_slug: "moonshot-v1-8k",
    context_length: 8192,
    supports_image_in: false,
    supports_video_in: false,
    supports_reasoning: false,
    raw: {
      context_length: 8192,
      supports_image_in: null,
      supports_video_in: null,
      supports_reasoning: null,
    },
  },
  {
    provider: "moonshot",
    model: "moonshot-v1-32k",
    full_slug: "moonshot-v1-32k",
    context_length: 32768,
    supports_image_in: false,
    supports_video_in: false,
    supports_reasoning: false,
    raw: {
      context_length: 32768,
      supports_image_in: null,
      supports_video_in: null,
      supports_reasoning: null,
    },
  },
  {
    provider: "moonshot",
    model: "moonshot-v1-128k",
    full_slug: "moonshot-v1-128k",
    context_length: 131072,
    supports_image_in: false,
    supports_video_in: false,
    supports_reasoning: false,
    raw: {
      context_length: 131072,
      supports_image_in: null,
      supports_video_in: null,
      supports_reasoning: null,
    },
  },
  {
    provider: "moonshot",
    model: "kimi-k2",
    full_slug: "kimi-k2",
    context_length: 131072,
    supports_image_in: false,
    supports_video_in: false,
    supports_reasoning: false,
    raw: {
      context_length: 131072,
      supports_image_in: null,
      supports_video_in: null,
      supports_reasoning: null,
    },
  },
];

// 简单运行时缓存：避免每次冷启动后反复重试外网 API
let cachedModels: ModelInfo[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

async function fetchModelsFromMoonshot(): Promise<ModelInfo[]> {
  const client = new OpenAI({
    apiKey: process.env.API_KEY || "",
    baseURL: "https://api.moonshot.cn/v1",
    timeout: 5000, // 5 秒超时，避免长时间阻塞
    maxRetries: 0,
  });

  const modelList = await client.models.list();
  const result: ModelInfo[] = [];

  for await (const model of modelList) {
    const supportsReasoning =
      "supports_reasoning" in model &&
      typeof model.supports_reasoning === "boolean"
        ? model.supports_reasoning
        : model.id.toLowerCase().includes("thinking");

    result.push({
      provider: "moonshot",
      model: model.id,
      full_slug: model.id,
      context_length:
        "context_length" in model && typeof model.context_length === "number"
          ? model.context_length
          : 0,
      supports_image_in:
        "supports_image_in" in model &&
        typeof model.supports_image_in === "boolean"
          ? model.supports_image_in
          : false,
      supports_video_in:
        "supports_video_in" in model &&
        typeof model.supports_video_in === "boolean"
          ? model.supports_video_in
          : false,
      supports_reasoning: supportsReasoning,
      raw: {
        context_length:
          "context_length" in model &&
          typeof model.context_length === "number"
            ? model.context_length
            : null,
        supports_image_in:
          "supports_image_in" in model &&
          typeof model.supports_image_in === "boolean"
            ? model.supports_image_in
            : null,
        supports_video_in:
          "supports_video_in" in model &&
          typeof model.supports_video_in === "boolean"
            ? model.supports_video_in
            : null,
        supports_reasoning:
          "supports_reasoning" in model &&
          typeof model.supports_reasoning === "boolean"
            ? model.supports_reasoning
            : null,
      },
    });
  }

  return result;
}

export async function listModelsHandler(c: Context) {
  // 内存缓存命中且未过期
  if (cachedModels && Date.now() - cacheTimestamp < CACHE_TTL) {
    return c.json(cachedModels);
  }

  try {
    const models = await fetchModelsFromMoonshot();
    cachedModels = models;
    cacheTimestamp = Date.now();
    return c.json(models);
  } catch (error) {
    console.warn(
      "[Models] Moonshot API unreachable, returning fallback list:",
      (error as Error).message
    );

    // 网络错误（ETIMEDOUT/ENOTFOUND等）时返回 fallback 而非 500
    cachedModels = FALLBACK_MODELS;
    cacheTimestamp = Date.now();
    return c.json(FALLBACK_MODELS);
  }
}
