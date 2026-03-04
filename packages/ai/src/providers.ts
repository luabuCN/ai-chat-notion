import { type LanguageModel } from "ai";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import OpenAI from "openai";

const moonshot = createMoonshotAI({
  apiKey: process.env.API_KEY || "",
  baseURL: "https://api.moonshot.cn/v1",
});

const openaiClient = new OpenAI({
  apiKey: process.env.API_KEY || "",
  baseURL: "https://api.moonshot.cn/v1",
});

// 使用指定模型创建 provider
export function getProviderWithModel(modelSlug: string): LanguageModel {
  return moonshot(modelSlug) as unknown as LanguageModel;
}

// 通过 OpenAI SDK 获取第一个可用模型 slug
export async function getFirstModelSlug(): Promise<string> {
  try {
    const modelList = await openaiClient.models.list();
    for await (const model of modelList) {
      return model.id;
    }
  } catch (error) {
    console.error("Failed to fetch first model:", error);
  }
  // 回退到默认模型
  return "moonshot-v1-8k";
}

// 默认 provider - 用于需要同步 provider 的场景
export const myProvider: LanguageModel = moonshot(
  "moonshot-v1-8k"
) as unknown as LanguageModel;
