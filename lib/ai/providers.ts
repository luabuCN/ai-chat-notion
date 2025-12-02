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

// Default model
export const myProvider = openrouter("openai/gpt-oss-20b:free");

// Function to get provider with custom model
export function getProviderWithModel(modelSlug: string) {
  return openrouter(modelSlug);
}


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
