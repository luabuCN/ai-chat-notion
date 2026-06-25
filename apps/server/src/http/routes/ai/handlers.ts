import { getProviderWithModel } from "@repo/ai";
import { streamText, type LanguageModel, type ModelMessage } from "ai";
import type { Context } from "hono";
import {
  DEFAULT_MODELSCOPE_MODEL,
  runModelScopeChat,
  streamModelScopeChat,
  type ModelScopeChatParams,
} from "../../ai/modelscope-chat.js";
import { getSessionFromRequest } from "../../../shared/auth.js";
import {
  completionRequestSchema,
  openaiRequestSchema,
  type OpenaiRequest,
} from "./schema.js";

function parseOpenaiParams(
  body: OpenaiRequest,
): ModelScopeChatParams | Response {
  if (Array.isArray(body.messages)) {
    return {
      messages: body.messages as ModelMessage[],
      temperature: body.temperature,
      model: body.model,
    };
  }

  if (typeof body.prompt === "string") {
    return {
      system: body.system,
      prompt: body.prompt,
      temperature: body.temperature,
      model: body.model,
    };
  }

  return new Response(
    JSON.stringify({
      error: "Provide either `prompt` (optional `system`) or `messages` array",
    }),
    {
      status: 400,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function completionHandler(c: Context) {
  try {
    const json = await c.req.json();
    const parsed = completionRequestSchema.safeParse(json);

    if (!parsed.success) {
      return c.text("Missing prompt or messages", 400);
    }

    const {
      prompt,
      messages,
      system: overrideSystem,
      temperature,
    } = parsed.data;

    if (!prompt && (!messages || messages.length === 0)) {
      return c.text("Missing prompt or messages", 400);
    }

    const model = getProviderWithModel(
      "moonshot-v1-8k",
    ) as unknown as LanguageModel;

    const result = streamText({
      model,
      ...(messages
        ? { messages: messages as ModelMessage[] }
        : { prompt: prompt as string }),
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
}

export async function openaiHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = openaiRequestSchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Invalid body" }, 400);
  }

  const body = parsed.data;
  const paramsOrResponse = parseOpenaiParams(body);
  if (paramsOrResponse instanceof Response) {
    return paramsOrResponse;
  }

  if (body.stream === true) {
    const streamResult = streamModelScopeChat(paramsOrResponse);
    if (streamResult === null) {
      return c.json(
        {
          error: "MODELSCOPE_API_KEY is not configured",
          model: body.model ?? DEFAULT_MODELSCOPE_MODEL,
        },
        503,
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
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  let text: string | null;
  try {
    text = await runModelScopeChat(paramsOrResponse);
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
        model: body.model ?? DEFAULT_MODELSCOPE_MODEL,
      },
      503,
    );
  }

  return c.json({ text });
}
