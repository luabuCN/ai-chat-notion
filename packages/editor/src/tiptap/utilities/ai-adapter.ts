import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export default async function generateAiResponse({ prompt }: { prompt: string; }) {
  const apiKey = ''
  if (!apiKey) {
    throw Error("Require Gemini api key");
  }

  const google = createGoogleGenerativeAI({
    apiKey: apiKey,
  });

  const result = streamText({
    model: google("gemini-2.5-flash"),
    prompt: prompt,
  });

  return result.toTextStreamResponse();
}
