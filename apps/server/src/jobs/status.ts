import { Redis as IORedis } from "ioredis";
import { createBullConnection } from "./connection.js";
import type { JobStatusRecord } from "./types.js";

const JOB_STATUS_TTL_SECONDS = 60 * 60;
let statusRedis: IORedis | null = null;

function jobStatusKey(jobId: string): string {
  return `cache:job:${jobId}`;
}

function getStatusRedis(): IORedis {
  if (!statusRedis) {
    statusRedis = createBullConnection();
    statusRedis.on("error", (error: Error) => {
      console.error("[JobStatusRedis] Error:", error.message);
    });
  }

  return statusRedis;
}

export async function setJobStatus(record: JobStatusRecord): Promise<void> {
  await getStatusRedis().set(
    jobStatusKey(record.jobId),
    JSON.stringify(record),
    "EX",
    JOB_STATUS_TTL_SECONDS
  );
}

export async function getJobStatus(
  jobId: string
): Promise<JobStatusRecord | null> {
  const raw = await getStatusRedis().get(jobStatusKey(jobId));
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as JobStatusRecord;
}

export async function patchJobStatus(
  jobId: string,
  patch: Partial<Omit<JobStatusRecord, "jobId">>
): Promise<void> {
  const current = await getJobStatus(jobId);
  if (!current) {
    return;
  }

  await setJobStatus({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export async function closeJobStatusRedis(): Promise<void> {
  if (!statusRedis) {
    return;
  }

  await statusRedis.quit().catch(() => statusRedis?.disconnect());
  statusRedis = null;
}
