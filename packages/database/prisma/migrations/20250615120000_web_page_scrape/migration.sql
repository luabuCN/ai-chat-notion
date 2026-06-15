-- CreateTable
CREATE TABLE "WebPageScrape" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "markdown" TEXT NOT NULL DEFAULT '',
    "html" TEXT,
    "rawHtml" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "warning" TEXT,
    "scrapedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPageScrape_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPageScrape_documentId_key" ON "WebPageScrape"("documentId");

-- CreateIndex
CREATE INDEX "WebPageScrape_sourceUrl_idx" ON "WebPageScrape"("sourceUrl");

-- AddForeignKey
ALTER TABLE "WebPageScrape" ADD CONSTRAINT "WebPageScrape_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "EditorDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
