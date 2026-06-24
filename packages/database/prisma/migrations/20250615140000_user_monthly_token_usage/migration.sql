-- CreateTable
CREATE TABLE "UserMonthlyTokenUsage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "periodKey" VARCHAR(7) NOT NULL,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "UserMonthlyTokenUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMonthlyTokenUsage_userId_idx" ON "UserMonthlyTokenUsage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMonthlyTokenUsage_userId_periodKey_key" ON "UserMonthlyTokenUsage"("userId", "periodKey");
