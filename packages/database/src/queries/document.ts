import "server-only";
import { ChatSDKError } from "../errors";
import { prisma } from "../client";
import { ArtifactKind } from "../types";
import { Document } from "./types";

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return [
      await prisma.document.create({
        data: {
          id,
          title,
          kind,
          content,
          userId,
          createdAt: new Date(),
        },
      }),
    ];
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    return await prisma.document.findMany({
      where: { id },
      orderBy: { createdAt: "asc" },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const documents = await prisma.document.findMany({
      where: { id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    return documents[0] || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await prisma.suggestion.deleteMany({
      where: {
        documentId: id,
        documentCreatedAt: { gt: timestamp },
      },
    });

    return await prisma.document.deleteMany({
      where: {
        id,
        createdAt: { gt: timestamp },
      },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function getDocumentsByUserId({ userId }: { userId: string }) {
  try {
    const documents = await prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // 获取每个文档的最新版本（按 id 分组，取最新的 createdAt）
    const latestDocuments = documents.reduce(
      (acc: Document[], doc: Document) => {
        const existing = acc.find((d: Document) => d.id === doc.id);
        if (!existing || doc.createdAt > existing.createdAt) {
          return [...acc.filter((d: Document) => d.id !== doc.id), doc];
        }
        return acc;
      },
      [] as Document[]
    );

    return latestDocuments;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by user id"
    );
  }
}
