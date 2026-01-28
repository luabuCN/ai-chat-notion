import { getFirstModelSlug, getProviderWithModel } from "@repo/ai";
import { streamText } from "ai";

export async function POST(req: Request) {
  try {
    const {
      prompt,
      messages,
      system: overrideSystem,
      temperature = 0.7,
    } = await req.json();

    if (!prompt && (!messages || messages.length === 0)) {
      return new Response("Missing prompt or messages", { status: 400 });
    }

    // const modelSlug = await getFirstModelSlug();
    const model = getProviderWithModel("openai/gpt-oss-20b:free");

    const result = streamText({
      model,
      prompt: messages ? undefined : prompt,
      messages: messages,
      system:
        overrideSystem ||
        "You are a helpful assistant. Please answer the question directly without using a thinking tone. Answer in the language used by the user.",
      maxOutputTokens: 1024,
      temperature,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI completion error:", error);
    return new Response("AI completion failed", { status: 500 });
  }
}
