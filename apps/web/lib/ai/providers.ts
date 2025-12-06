import { gateway } from "@ai-sdk/gateway";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

import { isTestEnvironment } from "../constants";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.API_KEY || ''
});

// Function to get provider with custom model
export function getProviderWithModel(modelSlug: string) {
  return openrouter(modelSlug);
}

// Get first available model slug from OpenRouter API
export async function getFirstModelSlug(): Promise<string> {
  try {
    const url = "https://openrouter.ai/api/frontend/models/find?max_price=0";
    const response = await fetch(url, { cache: 'no-store' });
    
    if (response.ok) {
      const jsonData = await response.json();
      const models = jsonData?.data?.models ?? [];
      if (models.length > 0) {
        return models[0].slug;
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
export const myProvider = openrouter("openai/gpt-oss-20b:free");


// isTestEnvironment
//   ? (() => {
//       const {
//         artifactModel,
//         chatModel,
//         reasoningModel,
//         titleModel,
//       } = require("./models.mock");
//       return customProvider({
//         languageModels: {
//           "chat-model": chatModel,
//           "chat-model-reasoning": reasoningModel,
//           "title-model": titleModel,
//           "artifact-model": artifactModel,
//         },
//       });
//     })()
//   : customProvider({
//       languageModels: {
//         "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
//         "chat-model-reasoning": wrapLanguageModel({
//           model: gateway.languageModel("xai/grok-3-mini"),
//           middleware: extractReasoningMiddleware({ tagName: "think" }),
//         }),
//         "title-model": gateway.languageModel("xai/grok-2-1212"),
//         "artifact-model": gateway.languageModel("xai/grok-2-1212"),
//       },
//     });
