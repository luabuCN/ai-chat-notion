import { apiJson } from "@/lib/api-client";
import type { JobStatusRecord } from "./types";

const POLL_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollJobUntilComplete<T = unknown>(
  jobId: string,
  onProgress?: (progress: string) => void
): Promise<T> {
  while (true) {
    const record = await apiJson<JobStatusRecord>(`/api/jobs/${jobId}`);

    onProgress?.(record.progress);

    if (record.status === "completed") {
      return record.result as T;
    }

    if (record.status === "failed") {
      throw new Error(record.error || record.progress || "任务失败");
    }

    await sleep(POLL_INTERVAL_MS);
  }
}
