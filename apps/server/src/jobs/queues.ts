import { randomUUID } from "node:crypto";
import { Queue, type ConnectionOptions } from "bullmq";
import { createBullConnection, isJobQueueEnabled } from "./connection.js";
import { setJobStatus } from "./status.js";
import type {
  DocumentImportJobData,
  ImageGenerationJobData,
  JobStatusRecord,
  JobType,
  WebScrapeJobData,
} from "./types.js";

const QUEUE_NAMES = {
  documentImport: "document-import",
  webScrape: "web-scrape",
  imageGeneration: "image-generation",
} as const;

let documentImportQueue: Queue<DocumentImportJobData> | null = null;
let webScrapeQueue: Queue<WebScrapeJobData> | null = null;
let imageGenerationQueue: Queue<ImageGenerationJobData> | null = null;

function bullConnection(): ConnectionOptions {
  return createBullConnection() as ConnectionOptions;
}

function getDocumentImportQueue(): Queue<DocumentImportJobData> {
  if (!documentImportQueue) {
    documentImportQueue = new Queue<DocumentImportJobData>(
      QUEUE_NAMES.documentImport,
      { connection: bullConnection() }
    );
  }
  return documentImportQueue;
}

function getWebScrapeQueue(): Queue<WebScrapeJobData> {
  if (!webScrapeQueue) {
    webScrapeQueue = new Queue<WebScrapeJobData>(QUEUE_NAMES.webScrape, {
      connection: bullConnection(),
    });
  }
  return webScrapeQueue;
}

function getImageGenerationQueue(): Queue<ImageGenerationJobData> {
  if (!imageGenerationQueue) {
    imageGenerationQueue = new Queue<ImageGenerationJobData>(
      QUEUE_NAMES.imageGeneration,
      { connection: bullConnection() }
    );
  }
  return imageGenerationQueue;
}

async function createJobRecord(
  type: JobType,
  userId: string,
  progress: string
): Promise<JobStatusRecord> {
  const now = new Date().toISOString();
  const record: JobStatusRecord = {
    jobId: randomUUID(),
    type,
    status: "pending",
    progress,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  await setJobStatus(record);
  return record;
}

export async function enqueueDocumentImportJob(
  data: DocumentImportJobData
): Promise<JobStatusRecord | null> {
  if (!isJobQueueEnabled()) {
    return null;
  }

  const record = await createJobRecord(
    "document-import",
    data.userId,
    "排队等待解析..."
  );

  await getDocumentImportQueue().add("process", data, {
    jobId: record.jobId,
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });

  return record;
}

export async function enqueueWebScrapeJob(
  data: WebScrapeJobData
): Promise<JobStatusRecord | null> {
  if (!isJobQueueEnabled()) {
    return null;
  }

  const record = await createJobRecord(
    "web-scrape",
    data.userId,
    "排队等待抓取网页..."
  );

  await getWebScrapeQueue().add("process", data, {
    jobId: record.jobId,
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });

  return record;
}

export async function enqueueImageGenerationJob(
  data: ImageGenerationJobData
): Promise<JobStatusRecord | null> {
  if (!isJobQueueEnabled()) {
    return null;
  }

  const record = await createJobRecord(
    "image-generation",
    data.userId,
    "正在生成图片..."
  );

  await getImageGenerationQueue().add("process", data, {
    jobId: record.jobId,
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 50,
  });

  return record;
}

export async function closeJobQueues(): Promise<void> {
  await Promise.all([
    documentImportQueue?.close(),
    webScrapeQueue?.close(),
    imageGenerationQueue?.close(),
  ]);
  documentImportQueue = null;
  webScrapeQueue = null;
  imageGenerationQueue = null;
}

export { QUEUE_NAMES };
