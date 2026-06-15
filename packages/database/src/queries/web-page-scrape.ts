import { randomUUID } from "node:crypto";
import { ChatSDKError } from "../errors.js";
import { prisma } from "../client.js";

export type WebPageScrapeRecord = {
  id: string;
  documentId: string;
  sourceUrl: string;
  markdown: string;
  html: string | null;
  rawHtml: string | null;
  summary: string | null;
  metadata: unknown;
  warning: string | null;
  scrapedAt: Date;
  createdAt: Date;
};

export async function createWebPageScrape({
  documentId,
  sourceUrl,
  markdown,
  html,
  rawHtml,
  summary,
  metadata,
  warning,
}: {
  documentId: string;
  sourceUrl: string;
  markdown: string;
  html?: string | null;
  rawHtml?: string | null;
  summary?: string | null;
  metadata?: unknown;
  warning?: string | null;
}): Promise<WebPageScrapeRecord> {
  const id = randomUUID();
  const metadataJson =
    metadata === undefined || metadata === null
      ? null
      : JSON.stringify(metadata);

  try {
    await prisma.$executeRaw`
      INSERT INTO "WebPageScrape" (
        "id",
        "documentId",
        "sourceUrl",
        "markdown",
        "html",
        "rawHtml",
        "summary",
        "metadata",
        "warning",
        "scrapedAt",
        "createdAt"
      ) VALUES (
        ${id}::uuid,
        ${documentId}::uuid,
        ${sourceUrl},
        ${markdown},
        ${html ?? null},
        ${rawHtml ?? null},
        ${summary ?? null},
        ${metadataJson}::jsonb,
        ${warning ?? null},
        NOW(),
        NOW()
      )
    `;

    return {
      id,
      documentId,
      sourceUrl,
      markdown,
      html: html ?? null,
      rawHtml: rawHtml ?? null,
      summary: summary ?? null,
      metadata: metadata ?? null,
      warning: warning ?? null,
      scrapedAt: new Date(),
      createdAt: new Date(),
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create web page scrape record"
    );
  }
}

export async function getWebPageScrapeByDocumentId({
  documentId,
}: {
  documentId: string;
}): Promise<WebPageScrapeRecord | null> {
  try {
    const rows = await prisma.$queryRaw<WebPageScrapeRecord[]>`
      SELECT
        "id",
        "documentId",
        "sourceUrl",
        "markdown",
        "html",
        "rawHtml",
        "summary",
        "metadata",
        "warning",
        "scrapedAt",
        "createdAt"
      FROM "WebPageScrape"
      WHERE "documentId" = ${documentId}::uuid
      LIMIT 1
    `;

    return rows[0] ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get web page scrape record"
    );
  }
}
