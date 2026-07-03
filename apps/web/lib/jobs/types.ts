export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobType = "document-import" | "web-scrape" | "image-generation";

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

export type DocumentImportJobResult = {
  docId: string;
  kind: string;
  title: string;
  contentFormat: "markdown" | "html";
  markdown: string;
  rawMarkdown: string;
  html?: string;
  pageCount?: number;
  warnings: string[];
};

export type WebScrapeJobResult = {
  documentId: string;
  title: string;
  sourcePageUrl: string;
  markdown: string;
  warning: string | null;
};
