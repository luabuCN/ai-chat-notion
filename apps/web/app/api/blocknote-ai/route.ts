import { convertToModelMessages, streamText } from "ai";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";
import { getProviderWithModel, getFirstModelSlug } from "@repo/ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, toolDefinitions } = await req.json();

    // Get the model provider
    const modelSlug = await getFirstModelSlug();
    const model = getProviderWithModel(modelSlug);

    const result = streamText({
      model,
      system: aiDocumentFormats.html.systemPrompt,
      messages: convertToModelMessages(
        injectDocumentStateMessages(messages)
      ),
      tools: toolDefinitionsToToolSet(toolDefinitions),
      toolChoice: "required",
      maxOutputTokens:1024,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in blocknote-ai API:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

