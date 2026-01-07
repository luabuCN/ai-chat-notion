-- CreateTable: DocumentCollaborator for guest collaboration
CREATE TABLE "DocumentCollaborator" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "userId" UUID,
    "permission" VARCHAR(20) NOT NULL DEFAULT 'edit',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "invitedBy" UUID NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(6),
    "acceptedAt" TIMESTAMP(6),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCollaborator_token_key" ON "DocumentCollaborator"("token");
CREATE UNIQUE INDEX "DocumentCollaborator_documentId_email_key" ON "DocumentCollaborator"("documentId", "email");
CREATE INDEX "DocumentCollaborator_documentId_idx" ON "DocumentCollaborator"("documentId");
CREATE INDEX "DocumentCollaborator_email_idx" ON "DocumentCollaborator"("email");
CREATE INDEX "DocumentCollaborator_userId_idx" ON "DocumentCollaborator"("userId");
CREATE INDEX "DocumentCollaborator_token_idx" ON "DocumentCollaborator"("token");

-- AddForeignKey
ALTER TABLE "DocumentCollaborator" ADD CONSTRAINT "DocumentCollaborator_documentId_fkey" 
    FOREIGN KEY ("documentId") REFERENCES "EditorDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

