import {
  claimImageGenerationUpload,
  getImageGenerationByProviderTaskId,
  updateImageGenerationByProviderTaskId,
} from "@repo/database";

function getFileExtension(contentType: string | null) {
  if (!contentType) return "png";
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "png";
}

async function uploadGeneratedImage(imageUrl: string) {
  const imageResponse = await fetch(imageUrl);

  if (!imageResponse.ok) {
    throw new Error("Failed to download generated image");
  }

  const blob = await imageResponse.blob();
  const contentType =
    blob.type || imageResponse.headers.get("content-type") || "image/png";
  const extension = getFileExtension(contentType);
  const file = new File([blob], `generated-${Date.now()}.${extension}`, {
    type: contentType,
  });

  const { UTApi } = await import("uploadthing/server");
  const utapi = new UTApi();
  const uploadResult = await utapi.uploadFiles(file);

  if (uploadResult.error || !uploadResult.data) {
    throw new Error(
      uploadResult.error?.message || "Failed to upload generated image"
    );
  }

  return {
    url: uploadResult.data.url,
    key: uploadResult.data.key,
  };
}

export type ImageTaskPollResult = {
  taskStatus: "SUCCEED" | "FAILED" | "PROCESSING";
  outputImageUrl?: string;
  errorMessage?: string;
};

export async function pollImageProviderTask(
  providerTaskId: string
): Promise<ImageTaskPollResult> {
  const imageRecord = await getImageGenerationByProviderTaskId({
    providerTaskId,
  });

  if (!imageRecord) {
    throw new Error("Image task not found");
  }

  if (imageRecord.status === "SUCCEED" && imageRecord.outputImageUrl) {
    return {
      taskStatus: "SUCCEED",
      outputImageUrl: imageRecord.outputImageUrl,
    };
  }

  const apiKey = process.env.MODELSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("MODELSCOPE_API_KEY is not configured");
  }

  const response = await fetch(
    `https://api-inference.modelscope.cn/v1/tasks/${providerTaskId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-ModelScope-Task-Type": "image_generation",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch task status");
  }

  const data = (await response.json()) as {
    task_status?: string;
    output_images?: string[];
    message?: string;
    error_message?: string;
    output?: { message?: string };
  };

  if (data.task_status === "SUCCEED") {
    const providerImageUrl = data.output_images?.[0];

    if (!providerImageUrl) {
      await updateImageGenerationByProviderTaskId({
        providerTaskId,
        data: {
          status: "FAILED",
          providerStatus: "FAILED",
          errorMessage: "Provider returned success without output image",
        },
      });
      return {
        taskStatus: "FAILED",
        errorMessage: "Provider returned success without output image",
      };
    }

    const claimedUpload = await claimImageGenerationUpload({
      providerTaskId,
    });

    if (!claimedUpload) {
      const latestRecord = await getImageGenerationByProviderTaskId({
        providerTaskId,
      });

      if (latestRecord?.outputImageUrl) {
        return {
          taskStatus: "SUCCEED",
          outputImageUrl: latestRecord.outputImageUrl,
        };
      }

      return { taskStatus: "PROCESSING" };
    }

    try {
      const uploadedImage = await uploadGeneratedImage(providerImageUrl);
      await updateImageGenerationByProviderTaskId({
        providerTaskId,
        data: {
          status: "SUCCEED",
          providerStatus: "SUCCEED",
          outputImageUrl: uploadedImage.url,
          outputFileKey: uploadedImage.key,
          errorMessage: null,
        },
      });
      return {
        taskStatus: "SUCCEED",
        outputImageUrl: uploadedImage.url,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload image";
      await updateImageGenerationByProviderTaskId({
        providerTaskId,
        data: {
          status: "FAILED",
          providerStatus: "SUCCEED",
          errorMessage,
        },
      });
      throw error;
    }
  }

  if (data.task_status === "FAILED") {
    const errorMessage =
      data.message ||
      data.error_message ||
      data.output?.message ||
      "Image generation failed";

    await updateImageGenerationByProviderTaskId({
      providerTaskId,
      data: {
        status: "FAILED",
        providerStatus: "FAILED",
        errorMessage,
      },
    });

    return {
      taskStatus: "FAILED",
      errorMessage,
    };
  }

  await updateImageGenerationByProviderTaskId({
    providerTaskId,
    data: {
      status: "PROCESSING",
      providerStatus: data.task_status ?? "RUNNING",
    },
  });

  return { taskStatus: "PROCESSING" };
}

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 120;

export async function pollImageTaskUntilComplete(
  providerTaskId: string,
  onProgress?: (message: string) => void
): Promise<{ outputImageUrl: string }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const result = await pollImageProviderTask(providerTaskId);

    if (result.taskStatus === "SUCCEED" && result.outputImageUrl) {
      return { outputImageUrl: result.outputImageUrl };
    }

    if (result.taskStatus === "FAILED") {
      throw new Error(result.errorMessage || "Image generation failed");
    }

    onProgress?.("正在生成图片...");
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Image generation timed out");
}
