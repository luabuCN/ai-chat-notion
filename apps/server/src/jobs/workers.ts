import { Worker, type ConnectionOptions } from "bullmq";
import { createBullConnection, isJobQueueEnabled } from "./connection.js";
import { closeJobStatusRedis, patchJobStatus } from "./status.js";
import { processDocumentImportJob } from "./processors/document-import.js";
import { processWebScrapeJob } from "./processors/web-scrape.js";
import { processImageGenerationJob } from "./processors/image-generation.js";
import { QUEUE_NAMES, closeJobQueues } from "./queues.js";
import type {
  DocumentImportJobData,
  ImageGenerationJobData,
  WebScrapeJobData,
} from "./types.js";

const workers: Worker[] = [];

async function handleJobFailure(
  jobId: string | undefined,
  error: Error
): Promise<void> {
  if (!jobId) {
    return;
  }

  await patchJobStatus(jobId, {
    status: "failed",
    progress: error.message,
    error: error.message,
  });
}

export async function startJobWorkers(): Promise<void> {
  if (!isJobQueueEnabled()) {
    console.log("[JobWorkers] Disabled (no REDIS_URL)");
    return;
  }

  if (workers.length > 0) {
    return;
  }

  const connection = createBullConnection() as ConnectionOptions;

  const documentImportWorker = new Worker<DocumentImportJobData>(
    QUEUE_NAMES.documentImport,
    async (job) => processDocumentImportJob(job),
    { connection, concurrency: 2 }
  );

  const webScrapeWorker = new Worker<WebScrapeJobData>(
    QUEUE_NAMES.webScrape,
    async (job) => processWebScrapeJob(job),
    { connection, concurrency: 2 }
  );

  const imageGenerationWorker = new Worker<ImageGenerationJobData>(
    QUEUE_NAMES.imageGeneration,
    async (job) => processImageGenerationJob(job),
    { connection, concurrency: 4 }
  );

  for (const worker of [
    documentImportWorker,
    webScrapeWorker,
    imageGenerationWorker,
  ]) {
    worker.on("failed", (job, error) => {
      void handleJobFailure(job?.id, error);
      console.error(`[JobWorkers] Job ${job?.id} failed:`, error.message);
    });
  }

  workers.push(documentImportWorker, webScrapeWorker, imageGenerationWorker);
  console.log("[JobWorkers] Started document-import, web-scrape, image-generation workers");
}

export async function stopJobWorkers(): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  workers.length = 0;
  await closeJobQueues();
  await closeJobStatusRedis();
}
