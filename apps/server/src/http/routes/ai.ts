import { Hono } from "hono";
import { getProviderWithModel } from "@repo/ai";
import { streamText, type LanguageModel, type ModelMessage } from "ai";
import {
  DEFAULT_MODELSCOPE_MODEL,
  runModelScopeChat,
  streamModelScopeChat,
  type ModelScopeChatParams,
} from "../ai/modelscope-chat.js";
import { getSessionFromRequest } from "../../shared/auth.js";

export const aiRoutes = new Hono();

aiRoutes.post("/completion", async (c) => {
  try {
    const {
      prompt,
      messages,
      system: overrideSystem,
      temperature = 0.7,
    } = await c.req.json();

    if (!prompt && (!messages || messages.length === 0)) {
      return c.text("Missing prompt or messages", 400);
    }

    const model = getProviderWithModel(
      "moonshot-v1-8k"
    ) as unknown as LanguageModel;

    const result = streamText({
      model,
      prompt: messages ? undefined : prompt,
      messages,
      system:
        overrideSystem ||
        "You are a helpful assistant. Please answer the question directly without using a thinking tone. Answer in the language used by the user.",
      maxOutputTokens: 1024,
      temperature,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI completion error:", error);
    return c.text("AI completion failed", 500);
  }
});

aiRoutes.post("/openai", async (c) => {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Invalid body" }, 400);
  }

  const o = body as Record<string, unknown>;
  let params: ModelScopeChatParams;

  if (Array.isArray(o.messages)) {
    params = {
      messages: o.messages as ModelMessage[],
      temperature: typeof o.temperature === "number" ? o.temperature : undefined,
      model: typeof o.model === "string" ? o.model : undefined,
    };
  } else if (typeof o.prompt === "string") {
    params = {
      system: typeof o.system === "string" ? o.system : undefined,
      prompt: o.prompt,
      temperature: typeof o.temperature === "number" ? o.temperature : undefined,
      model: typeof o.model === "string" ? o.model : undefined,
    };
  } else {
    return c.json(
      { error: "Provide either `prompt` (optional `system`) or `messages` array" },
      400
    );
  }

  if (o.stream === true) {
    const streamResult = streamModelScopeChat(params);
    if (streamResult === null) {
      return c.json(
        {
          error: "MODELSCOPE_API_KEY is not configured",
          model: o.model ?? DEFAULT_MODELSCOPE_MODEL,
        },
        503
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const delta of streamResult.textStream) {
            controller.enqueue(encoder.encode(delta));
          }
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "stream failed";
          controller.enqueue(encoder.encode(`\n\n[Error] ${message}`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  let text: string | null;
  try {
    text = await runModelScopeChat(params);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Upstream model request failed";
    return c.json({ error: message }, 502);
  }

  if (text === null) {
    return c.json(
      {
        error: "MODELSCOPE_API_KEY is not configured",
        model: o.model ?? DEFAULT_MODELSCOPE_MODEL,
      },
      503
    );
  }

  return c.json({ text });
});
