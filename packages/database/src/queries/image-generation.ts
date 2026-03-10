import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";

type PromptOptions = {
  styles?: string[];
  scenes?: string[];
  lighting?: string[];
  camera?: string[];
  quality?: string[];
  negatives?: string[];
};

function isImageGenerationTableMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ImageGeneration") && message.includes("does not exist");
}

export async function createImageGeneration(input: {
  userId: string;
  workspaceId?: string | null;
  workspaceRole: string;
  workspacePermission?: string | null;
  prompt: string;
  negativePrompt?: string | null;
  promptOptions?: PromptOptions | null;
  model: string;
  aspectRatio?: string | null;
  size?: string | null;
  seed?: number | null;
  steps?: number | null;
  providerTaskId?: string | null;
  providerStatus?: string | null;
  sourceImageUrl?: string | null;
}) {
  try {
    return await prisma.imageGeneration.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId ?? null,
        workspaceRole: input.workspaceRole,
        workspacePermission: input.workspacePermission ?? null,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt ?? null,
        promptOptions: input.promptOptions ?? undefined,
        model: input.model,
        aspectRatio: input.aspectRatio ?? null,
        size: input.size ?? null,
        seed: input.seed ?? null,
        steps: input.steps ?? null,
        providerTaskId: input.providerTaskId ?? null,
        providerStatus: input.providerStatus ?? "PENDING",
        sourceImageUrl: input.sourceImageUrl ?? null,
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create image generation"
    );
  }
}

export async function getImageGenerationByProviderTaskId({
  providerTaskId,
}: {
  providerTaskId: string;
}) {
  try {
    return await prisma.imageGeneration.findUnique({
      where: { providerTaskId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  } catch (error) {
    if (isImageGenerationTableMissing(error)) {
      return null;
    }

    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get image generation by provider task id"
    );
  }
}

export async function updateImageGenerationByProviderTaskId({
  providerTaskId,
  data,
}: {
  providerTaskId: string;
  data: {
    providerStatus?: string | null;
    status?: string;
    outputImageUrl?: string | null;
    outputFileKey?: string | null;
    errorMessage?: string | null;
  };
}) {
  try {
    return await prisma.imageGeneration.update({
      where: { providerTaskId },
      data,
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update image generation"
    );
  }
}

export async function getImageGenerationsForUser({
  userId,
  workspaceId,
  limit = 24,
}: {
  userId: string;
  workspaceId?: string | null;
  limit?: number;
}) {
  try {
    const where =
      workspaceId === undefined
        ? { userId }
        : { userId, workspaceId: workspaceId ?? null };

    return await prisma.imageGeneration.findMany({
      where,
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    if (isImageGenerationTableMissing(error)) {
      return [];
    }

    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get image generations for user"
    );
  }
}

export async function getImageGenerationsForWorkspace({
  workspaceId,
  limit = 36,
}: {
  workspaceId: string;
  limit?: number;
}) {
  try {
    return await prisma.imageGeneration.findMany({
      where: { workspaceId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    if (isImageGenerationTableMissing(error)) {
      return [];
    }

    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get image generations for workspace"
    );
  }
}