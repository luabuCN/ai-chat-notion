import type { Job } from "bullmq";
import { createWebPageScrape } from "@repo/database";
import {
  resolveScrapeTitle,
  scrapeUrlWithFirecrawl,
} from "../../shared/firecrawl.js";
import { patchJobStatus } from "../status.js";
import type { WebScrapeJobData } from "../types.js";

export async function processWebScrapeJob(
  job: Job<WebScrapeJobData>
): Promise<unknown> {
  const { sourceUrl, documentId, excludeTags, includeTags } = job.data;

  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("网页抓取服务未配置");
  }

  await patchJobStatus(job.id!, {
    status: "processing",
    progress: "正在抓取网页内容...",
  });

  const scrapeData = await scrapeUrlWithFirecrawl(sourceUrl, apiKey, {
    excludeTags,
    includeTags,
  });

  const markdown = scrapeData.markdown?.trim() ?? "";
  const title = resolveScrapeTitle(sourceUrl, scrapeData.metadata);

  await createWebPageScrape({
    documentId,
    sourceUrl,
    markdown,
    html: scrapeData.html ?? null,
    rawHtml: scrapeData.rawHtml ?? null,
    summary: scrapeData.summary ?? null,
    metadata: scrapeData.metadata ?? null,
    warning: scrapeData.warning ?? null,
  });

  const payload = {
    documentId,
    title,
    sourcePageUrl: sourceUrl,
    markdown,
    warning: scrapeData.warning ?? null,
  };

  await patchJobStatus(job.id!, {
    status: "completed",
    progress: "网页抓取完成",
    result: payload,
  });

  return payload;
}
