import { NextResponse } from "next/server";
import {
  createImageGeneration,
  getWorkspaceBySlug,
  getWorkspaceMemberPermission,
  hasWorkspaceAccess,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { getAuthFromRequest } from "@/lib/api-auth";

type GenerationRequestBody = {
  model?: string;
  prompt?: string;
  negative_prompt?: string;
  size?: string;
  seed?: number;
  steps?: number;
  workspaceSlug?: string;
  promptOptions?: {
    styles?: string[];
    scenes?: string[];
    lighting?: string[];
    camera?: string[];
    quality?: string[];
    negatives?: string[];
  };
  sourceImageUrl?: string;
};

export async function POST(req: Request) {
  const { user } = getAuthFromRequest(req);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = (await req.json()) as GenerationRequestBody;
    const { model, prompt, negative_prompt, size, seed, steps, workspaceSlug } =
      body;

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    let workspaceId: string | null = null;
    let workspaceRole = "personal";
    let workspacePermission: string | null = null;

    if (workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });

      if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      }

      const hasAccess = await hasWorkspaceAccess({
        workspaceId: workspace.id,
        userId: user.id,
      });

      if (!hasAccess) {
        return new ChatSDKError("unauthorized:chat", "Access denied").toResponse();
      }

      const memberPermission = await getWorkspaceMemberPermission({
        workspaceId: workspace.id,
        userId: user.id,
      });

      workspaceId = workspace.id;
      workspaceRole = workspace.ownerId === user.id ? "owner" : memberPermission?.role ?? "member";
      workspacePermission =
        workspace.ownerId === user.id ? "edit" : memberPermission?.permission ?? null;

      const canGenerate =
        workspace.ownerId === user.id ||
        memberPermission?.role === "admin" ||
        memberPermission?.permission === "edit";

      if (!canGenerate) {
        return NextResponse.json(
          { error: "Current workspace role does not allow image generation" },
          { status: 403 }
        );
      }
    }

    const apiKey = process.env.MODELSCOPE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "MODELSCOPE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const requestBody: Record<string, unknown> = {
      model: model || "Tongyi-MAI/Z-Image-Turbo",
      prompt: prompt.trim(),
    };

    if (negative_prompt) requestBody.negative_prompt = negative_prompt;
    if (size) requestBody.size = size;
    if (seed !== undefined) requestBody.seed = seed;
    if (steps !== undefined) requestBody.steps = steps;

    const response = await fetch("https://api-inference.modelscope.cn/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-ModelScope-Async-Mode": "true",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    const history = await createImageGeneration({
      userId: user.id,
      workspaceId,
      workspaceRole,
      workspacePermission,
      prompt: prompt.trim(),
      negativePrompt: negative_prompt ?? null,
      promptOptions: body.promptOptions,
      model: model || "Tongyi-MAI/Z-Image-Turbo",
      aspectRatio: size ?? null,
      size: size ?? null,
      seed: seed ?? null,
      steps: steps ?? null,
      providerTaskId: data.task_id,
      providerStatus: data.task_status ?? "PENDING",
      sourceImageUrl: body.sourceImageUrl ?? null,
    });

    return NextResponse.json({ ...data, historyId: history.id });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to create image generation task" },
      { status: 500 }
    );
  }
}


