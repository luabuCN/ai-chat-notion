import { auth } from "@/app/(auth)/auth";
import {
  DEFAULT_MODELSCOPE_MODEL,
  runModelScopeChat,
  type ModelScopeChatParams,
} from "@/lib/ai/modelscope-chat";
import { NextResponse } from "next/server";
import type { ModelMessage } from "ai";

/**
 * 公用 ModelScope（OpenAI 兼容）对话 API。
 *
 * 二选一：
 * - `{ "prompt": string, "system"?: string, "temperature"?: number, "model"?: string }`
 * - `{ "messages": CoreMessage[], "temperature"?: number, "model"?: string }`
 *
 * 成功：`{ "text": string }`；未配置密钥：`503`；未登录：`401`。
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;

  let params: ModelScopeChatParams;

  if (Array.isArray(o.messages)) {
    params = {
      messages: o.messages as ModelMessage[],
      temperature:
        typeof o.temperature === "number" ? o.temperature : undefined,
      model: typeof o.model === "string" ? o.model : undefined,
    };
  } else if (typeof o.prompt === "string") {
    params = {
      system: typeof o.system === "string" ? o.system : undefined,
      prompt: o.prompt,
      temperature:
        typeof o.temperature === "number" ? o.temperature : undefined,
      model: typeof o.model === "string" ? o.model : undefined,
    };
  } else {
    return NextResponse.json(
      {
        error:
          "Provide either `prompt` (optional `system`) or `messages` array",
      },
      { status: 400 }
    );
  }

  const text = await runModelScopeChat(params);

  if (text === null) {
    return NextResponse.json(
      {
        error: "MODELSCOPE_API_KEY is not configured",
        model: o.model ?? DEFAULT_MODELSCOPE_MODEL,
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ text });
}
