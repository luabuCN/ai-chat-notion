import type { Context } from "hono";
import {
  createImageGeneration,
  deleteImageGenerationById,
  getImageGenerationByProviderTaskId,
  getImageGenerationsForUser,
  getImageGenerationsForWorkspace,
  getWorkspaceBySlug,
  getWorkspaceMemberPermission,
  hasWorkspaceAccess,
} from "@repo/database";
import { getSessionFromRequest } from "../../../shared/auth.js";
import { ApiError } from "../../../shared/errors.js";
import { enqueueImageGenerationJob } from "../../../jobs/queues.js";
import { isJobQueueEnabled } from "../../../jobs/connection.js";
import { pollImageProviderTask } from "../../../shared/image-generation/poll-task.js";

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

export async function createImageGenerationHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  try {
    const body = (await c.req.json()) as GenerationRequestBody;
    const { model, prompt, negative_prompt, size, seed, steps, workspaceSlug } =
      body;

    if (!prompt?.trim()) {
      return c.json({ error: "Prompt is required" }, 400);
    }

    let workspaceId: string | null = null;
    let workspaceRole = "personal";
    let workspacePermission: string | null = null;

    if (workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });

      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      const hasAccess = await hasWorkspaceAccess({
        workspaceId: workspace.id,
        userId: session.user.id,
      });

      if (!hasAccess) {
        return new ApiError("unauthorized:api", "Access denied").toResponse();
      }

      const memberPermission = await getWorkspaceMemberPermission({
        workspaceId: workspace.id,
        userId: session.user.id,
      });

      workspaceId = workspace.id;
      workspaceRole =
        workspace.ownerId === session.user.id
          ? "owner"
          : memberPermission?.role ?? "member";
      workspacePermission =
        workspace.ownerId === session.user.id
          ? "edit"
          : memberPermission?.permission ?? null;

      const canGenerate =
        workspace.ownerId === session.user.id ||
        memberPermission?.role === "admin" ||
        memberPermission?.permission === "edit";

      if (!canGenerate) {
        return c.json(
          {
            error:
              "Current workspace role does not allow image generation",
          },
          403
        );
      }
    }

    const apiKey = process.env.MODELSCOPE_API_KEY;

    if (!apiKey) {
      return c.json(
        { error: "MODELSCOPE_API_KEY is not configured" },
        500
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

    const response = await fetch(
      "https://api-inference.modelscope.cn/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-ModelScope-Async-Mode": "true",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return c.json({ error: errorText }, response.status as any);
    }

    const data = await response.json();
    const history = await createImageGeneration({
      userId: session.user.id,
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

    const backgroundJob = isJobQueueEnabled()
      ? await enqueueImageGenerationJob({
          userId: session.user.id,
          providerTaskId: data.task_id,
        })
      : null;

    return c.json({
      ...data,
      historyId: history.id,
      backgroundJobId: backgroundJob?.jobId ?? null,
    });
  } catch (error) {
    console.error("Error generating image:", error);
    return c.json(
      { error: "Failed to create image generation task" },
      500
    );
  }
}

export async function getImageHistoryHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const searchParams = new URL(c.req.url).searchParams;
  const workspaceSlug = searchParams.get("workspace");
  const scope = searchParams.get("scope") || "workspace";
  const limit = Number.parseInt(searchParams.get("limit") || "24", 10);

  try {
    let workspaceId: string | null | undefined;

    if (workspaceSlug) {
      const workspace = await getWorkspaceBySlug({ slug: workspaceSlug });

      if (!workspace) {
        return c.json({ items: [] });
      }

      const hasAccess = await hasWorkspaceAccess({
        workspaceId: workspace.id,
        userId: session.user.id,
      });

      if (!hasAccess) {
        return new ApiError("unauthorized:api", "Access denied").toResponse();
      }

      workspaceId = workspace.id;

      if (scope !== "user") {
        const items = await getImageGenerationsForWorkspace({
          workspaceId: workspace.id,
          limit,
        });
        return c.json({ items, scope: "workspace" });
      }
    }

    const items = await getImageGenerationsForUser({
      userId: session.user.id,
      workspaceId,
      limit,
    });

    return c.json({ items, scope: "user" });
  } catch (error) {
    console.error("Failed to fetch image history:", error);
    return c.json({
      items: [],
      scope: workspaceSlug && scope !== "user" ? "workspace" : "user",
    });
  }
}

export async function getImageTaskHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  try {
    const id = c.req.param("id");
    if (!id) {
      return new ApiError("bad_request:api").toResponse();
    }
    const imageRecord = await getImageGenerationByProviderTaskId({
      providerTaskId: id,
    });

    if (!imageRecord) {
      return c.json({ error: "Image task not found" }, 404);
    }

    if (imageRecord.workspaceId) {
      const hasAccess = await hasWorkspaceAccess({
        workspaceId: imageRecord.workspaceId,
        userId: session.user.id,
      });

      if (!hasAccess) {
        return new ApiError("unauthorized:api", "Access denied").toResponse();
      }
    } else if (imageRecord.userId !== session.user.id) {
      return new ApiError("unauthorized:api", "Access denied").toResponse();
    }

    if (imageRecord.status === "SUCCEED" && imageRecord.outputImageUrl) {
      return c.json({
        task_id: id,
        task_status: "SUCCEED",
        output_images: [imageRecord.outputImageUrl],
        history: imageRecord,
      });
    }

    if (imageRecord.status === "FAILED") {
      return c.json({
        task_id: id,
        task_status: "FAILED",
        history: imageRecord,
        message: imageRecord.errorMessage || "Image generation failed",
      });
    }

    const result = await pollImageProviderTask(id);

    if (result.taskStatus === "SUCCEED") {
      const history = await getImageGenerationByProviderTaskId({
        providerTaskId: id,
      });

      return c.json({
        task_id: id,
        task_status: "SUCCEED",
        output_images: [result.outputImageUrl ?? history?.outputImageUrl],
        history,
      });
    }

    if (result.taskStatus === "FAILED") {
      const history = await getImageGenerationByProviderTaskId({
        providerTaskId: id,
      });

      return c.json({
        task_id: id,
        task_status: "FAILED",
        history,
        message: result.errorMessage,
      });
    }

    const history = await getImageGenerationByProviderTaskId({
      providerTaskId: id,
    });

    return c.json({
      task_id: id,
      task_status: "PROCESSING",
      history,
    });
  } catch (error) {
    console.error("Error fetching task status:", error);
    return c.json(
      { error: "Failed to fetch task status" },
      500
    );
  }
}

export async function deleteImageHistoryHandler(c: Context) {
  const session = await getSessionFromRequest(c.req.raw);
  if (!session) {
    return new ApiError("unauthorized:api").toResponse();
  }

  const id = c.req.param("id");
  if (!id) {
    return new ApiError("bad_request:api").toResponse();
  }

  try {
    const deleted = await deleteImageGenerationById({
      id,
      userId: session.user.id,
    });

    if (!deleted) {
      return new ApiError("not_found:api", "Image record not found").toResponse();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to delete image history:", error);
    return new ApiError("bad_request:api", "Failed to delete image").toResponse();
  }
}
