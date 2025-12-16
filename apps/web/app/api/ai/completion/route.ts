import { getFirstModelSlug, getProviderWithModel } from "@repo/ai";
import { streamText } from "ai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response("Missing prompt", { status: 400 });
    }

    const modelSlug = await getFirstModelSlug();
    const model = getProviderWithModel(modelSlug);

    const result = streamText({
      model,
      prompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI completion error:", error);
    return new Response("AI completion failed", { status: 500 });
  }
}
