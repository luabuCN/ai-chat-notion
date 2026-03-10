-- CreateTable
CREATE TABLE "ImageGeneration" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "workspaceId" UUID,
    "workspaceRole" VARCHAR(20) NOT NULL DEFAULT 'member',
    "workspacePermission" VARCHAR(20),
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "promptOptions" JSONB,
    "model" VARCHAR(100) NOT NULL,
    "aspectRatio" VARCHAR(20),
    "size" VARCHAR(20),
    "seed" INTEGER,
    "steps" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "providerTaskId" VARCHAR(100),
    "providerStatus" VARCHAR(30),
    "sourceImageUrl" TEXT,
    "outputImageUrl" TEXT,
    "outputFileKey" VARCHAR(255),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageGeneration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImageGeneration_providerTaskId_key" ON "ImageGeneration"("providerTaskId");
CREATE INDEX "ImageGeneration_userId_createdAt_idx" ON "ImageGeneration"("userId", "createdAt" DESC);
CREATE INDEX "ImageGeneration_workspaceId_createdAt_idx" ON "ImageGeneration"("workspaceId", "createdAt" DESC);
CREATE INDEX "ImageGeneration_status_createdAt_idx" ON "ImageGeneration"("status", "createdAt" DESC);

ALTER TABLE "ImageGeneration" ADD CONSTRAINT "ImageGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImageGeneration" ADD CONSTRAINT "ImageGeneration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
