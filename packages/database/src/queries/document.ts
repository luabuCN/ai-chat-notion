import { ChatSDKError } from "../errors.js";
import { prisma } from "../client.js";
import { ArtifactKind } from "../types.js";
import { Document } from "./types.js";

const ARTIFACT_DOCUMENT_TOOL_TYPES = new Set([
  "tool-createDocument",
  "tool-updateDocument",
  "tool-requestSuggestions",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractArtifactDocumentIdsFromMessages(
  messages: Array<{ parts: unknown }>
): string[] {
  const ids = new Set<string>();

  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      continue;
    }

    for (const part of message.parts) {
      if (!isRecord(part)) {
        continue;
      }

      const type = part.type;
      if (
        typeof type !== "string" ||
        !ARTIFACT_DOCUMENT_TOOL_TYPES.has(type)
      ) {
        continue;
      }

      const output = part.output;
      if (!isRecord(output) || "error" in output) {
        continue;
      }

      const id = output.id;
      if (typeof id === "string") {
        ids.add(id);
      }
    }
  }

  return [...ids];
}

export async function deleteDocumentsByIds({ ids }: { ids: string[] }) {
  if (ids.length === 0) {
    return;
  }

  try {
    await prisma.suggestion.deleteMany({
      where: { documentId: { in: ids } },
    });

    await prisma.document.deleteMany({
      where: { id: { in: ids } },
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by ids"
    );
  }
}

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
    // 幂等保护：若最新版本与本次内容完全一致，则复用现有版本，避免重复创建相同的版本行
    // （例如模型在 createDocument 后又对同一文档触发了 updateDocument，重新生成出几乎相同的内容）。
    const latest = await prisma.document.findFirst({
      where: { id },
      orderBy: { createdAt: "desc" },
    });

    if (
      latest &&
      latest.userId === userId &&
      latest.title === title &&
      latest.kind === kind &&
      latest.content === content
    ) {
      return [latest];
    }

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
