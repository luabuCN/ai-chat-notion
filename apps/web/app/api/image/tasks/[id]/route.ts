import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import {
  getImageGenerationByProviderTaskId,
  hasWorkspaceAccess,
  updateImageGenerationByProviderTaskId,
} from "@repo/database";
import { ChatSDKError } from "@/lib/errors";
import { getAuthFromRequest } from "@/lib/api-auth";

const utapi = new UTApi();

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = getAuthFromRequest(req);

  if (!user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const { id } = await params;
    const imageRecord = await getImageGenerationByProviderTaskId({
      providerTaskId: id,
    });

    if (!imageRecord) {
      return NextResponse.json({ error: "Image task not found" }, { status: 404 });
    }

    if (imageRecord.workspaceId) {
      const hasAccess = await hasWorkspaceAccess({
        workspaceId: imageRecord.workspaceId,
        userId: user.id,
      });

      if (!hasAccess) {
        return new ChatSDKError("unauthorized:chat", "Access denied").toResponse();
      }
    } else if (imageRecord.userId !== user.id) {
      return new ChatSDKError("unauthorized:chat", "Access denied").toResponse();
    }

    if (imageRecord.status === "SUCCEED" && imageRecord.outputImageUrl) {
      return NextResponse.json({
        task_id: id,
        task_status: "SUCCEED",
        output_images: [imageRecord.outputImageUrl],
        history: imageRecord,
      });
    }

    const apiKey = process.env.MODELSCOPE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "MODELSCOPE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api-inference.modelscope.cn/v1/tasks/${id}`,
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
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();

    if (data.task_status === "SUCCEED") {
      const providerImageUrl = data.output_images?.[0];

      if (!providerImageUrl) {
        await updateImageGenerationByProviderTaskId({
          providerTaskId: id,
          data: {
            status: "FAILED",
            providerStatus: "FAILED",
            errorMessage: "Provider returned success without output image",
          },
        });

        return NextResponse.json(
          { error: "Provider returned success without output image" },
          { status: 502 }
        );
      }

      let history = imageRecord;

      if (!imageRecord.outputImageUrl) {
        const uploadedImage = await uploadGeneratedImage(providerImageUrl);
        history = await updateImageGenerationByProviderTaskId({
          providerTaskId: id,
          data: {
            status: "SUCCEED",
            providerStatus: "SUCCEED",
            outputImageUrl: uploadedImage.url,
            outputFileKey: uploadedImage.key,
            errorMessage: null,
          },
        });
      }

      return NextResponse.json({
        ...data,
        output_images: [history.outputImageUrl ?? providerImageUrl],
        history,
      });
    }

    if (data.task_status === "FAILED") {
      const errorMessage =
        data.message ||
        data.error_message ||
        data.output?.message ||
        "Image generation failed";

      const history = await updateImageGenerationByProviderTaskId({
        providerTaskId: id,
        data: {
          status: "FAILED",
          providerStatus: "FAILED",
          errorMessage,
        },
      });

      return NextResponse.json({ ...data, history });
    }

    const history = await updateImageGenerationByProviderTaskId({
      providerTaskId: id,
      data: {
        status: "PROCESSING",
        providerStatus: data.task_status ?? "RUNNING",
      },
    });

    return NextResponse.json({ ...data, history });
  } catch (error) {
    console.error("Error fetching task status:", error);
    return NextResponse.json(
      { error: "Failed to fetch task status" },
      { status: 500 }
    );
  }
}
