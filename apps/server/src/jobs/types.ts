export type JobType = "document-import" | "web-scrape" | "image-generation";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobStatusRecord = {
  jobId: string;
  type: JobType;
  status: JobStatus;
  progress: string;
  userId: string;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentImportJobData = {
  userId: string;
  docId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  polish: "auto" | "always" | "never";
};

export type WebScrapeJobData = {
  userId: string;
  documentId: string;
  sourceUrl: string;
  excludeTags?: string[];
  includeTags?: string[];
};

export type ImageGenerationJobData = {
  userId: string;
  providerTaskId: string;
};
