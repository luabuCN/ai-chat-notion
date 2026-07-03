import type { Job } from "bullmq";
import { pollImageTaskUntilComplete } from "../../shared/image-generation/poll-task.js";
import { broadcast } from "../../ws/connection-pool.js";
import { patchJobStatus } from "../status.js";
import type { ImageGenerationJobData } from "../types.js";

export async function processImageGenerationJob(
  job: Job<ImageGenerationJobData>
): Promise<unknown> {
  const { providerTaskId, userId } = job.data;

  await patchJobStatus(job.id!, {
    status: "processing",
    progress: "正在生成图片...",
  });

  const result = await pollImageTaskUntilComplete(
    providerTaskId,
    (message) => {
      void patchJobStatus(job.id!, { progress: message });
    }
  );

  const payload = {
    providerTaskId,
    outputImageUrl: result.outputImageUrl,
  };

  await patchJobStatus(job.id!, {
    status: "completed",
    progress: "图片生成完成",
    result: payload,
  });

  broadcast(userId, {
    type: "image_generation_complete",
    providerTaskId,
    outputImageUrl: result.outputImageUrl,
  });

  return payload;
}
