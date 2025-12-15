import {
  type LanguageModel,
} from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.API_KEY || ''
});

// Function to get provider with custom model
export function getProviderWithModel(modelSlug: string): LanguageModel {
  return openrouter(modelSlug);
}

// Get first available model slug from OpenRouter API
export async function getFirstModelSlug(): Promise<string> {
  try {
    // 在客户端通过 API 路由获取，避免 CORS 问题
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    const url = typeof window !== "undefined"
      ? `${baseUrl}/api/models`
      : "https://openrouter.ai/api/frontend/models/find?max_price=0";
    
    const response = await fetch(url, { cache: 'no-store' });
    
    if (response.ok) {
      const jsonData = await response.json();
      
      // 处理 API 路由返回的格式
      if (Array.isArray(jsonData)) {
        // 来自 /api/models 路由的格式
        if (jsonData.length > 0) {
          return jsonData[0].endpoint.model_variant_slug;
        }
      } else {
        // 直接调用 OpenRouter API 的格式
        const models = jsonData?.data?.models ?? [];
        if (models.length > 0) {
          return models[0].endpoint.model_variant_slug;
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch first model:', error);
  }
  // Fallback to a default model if API fails
  return "openai/gpt-oss-20b:free";
}

// Default provider - will use first available model dynamically
// For synchronous usage, this provides a fallback
export const myProvider: LanguageModel = openrouter("openai/gpt-oss-20b:free");
