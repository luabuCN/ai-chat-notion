import { tool, type UIMessageStreamWriter } from "ai";
import type { AuthSession } from "../../../shared/auth.js";
import { z } from "zod";
import { documentHandlersByArtifactKind } from "../../artifacts/server.js";
import { getDocumentById } from "@repo/database";
import type { ChatMessage } from "../../../shared/types.js";

type UpdateDocumentProps = {
  session: AuthSession;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  // 本次请求内已创建的文档 id 集合，与 createDocument 共享。
  createdDocumentIds: Set<string>;
};

export const updateDocument = ({
  session,
  dataStream,
  createdDocumentIds,
}: UpdateDocumentProps) =>
  tool({
    description: "Update a document with the given description.",
    inputSchema: z.object({
      id: z.string().describe("The ID of the document to update"),
      description: z
        .string()
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      // 刚在本次回复里创建的文档不应立刻更新：直接返回，避免重复生成与重复版本。
      if (createdDocumentIds.has(id)) {
        return {
          id,
          content:
            "This document was just created in this response. Do not update it now — wait for explicit user feedback before making changes.",
        };
      }

      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: "The document has been updated successfully.",
      };
    },
  });
