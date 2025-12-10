-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(64) NOT NULL,
    "password" VARCHAR(64),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" VARCHAR(10) NOT NULL DEFAULT 'private',
    "lastContext" JSONB,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "role" VARCHAR NOT NULL,
    "content" JSON NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message_v2" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "role" VARCHAR NOT NULL,
    "parts" JSON NOT NULL,
    "attachments" JSON NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Message_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "chatId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,

    CONSTRAINT "Vote_chatId_messageId_pk" PRIMARY KEY ("chatId","messageId")
);

-- CreateTable
CREATE TABLE "Vote_v2" (
    "chatId" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "isUpvoted" BOOLEAN NOT NULL,

    CONSTRAINT "Vote_v2_chatId_messageId_pk" PRIMARY KEY ("chatId","messageId")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "createdAt" TIMESTAMP(6) NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "userId" UUID NOT NULL,
    "text" VARCHAR NOT NULL DEFAULT 'text',

    CONSTRAINT "Document_id_createdAt_pk" PRIMARY KEY ("id","createdAt")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "documentCreatedAt" TIMESTAMP(6) NOT NULL,
    "originalText" TEXT NOT NULL,
    "suggestedText" TEXT NOT NULL,
    "description" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Suggestion_id_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chatId" UUID NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Stream_id_pk" PRIMARY KEY ("id")
);

