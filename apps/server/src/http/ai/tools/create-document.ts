import { tool, type UIMessageStreamWriter } from "ai";
import type { AuthSession } from "../../../shared/auth.js";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "../../artifacts/server.js";
import type { ChatMessage } from "../../../shared/types.js";
import { generateUUID } from "../../../shared/utils.js";

type CreateDocumentProps = {
  session: AuthSession;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  // 本次请求内已创建的文档 id 集合，与 updateDocument 共享，用于阻止刚创建即更新的重复生成。
  createdDocumentIds: Set<string>;
};

export const createDocument = ({
  session,
  dataStream,
  createdDocumentIds,
}: CreateDocumentProps) => {
  let createdDocument:
    | {
        id: string;
        title: string;
        kind: (typeof artifactKinds)[number];
      }
    | null = null;
  let isCreating = false;

  return tool({
    description:
      "Create one artifact document for writing or content creation. This is NOT related to the viewDocument tool — never call viewDocument to verify an artifact. Only call this tool once per response.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
    }),
    execute: async ({ title, kind }) => {
      if (createdDocument || isCreating) {
        return {
          ...(createdDocument ?? { id: "", title, kind }),
          content:
            "A document has already been created in this response. Reuse or update that document instead of creating another one.",
        };
      }

      isCreating = true;

      try {
        const id = generateUUID();

        dataStream.write({
          type: "data-kind",
          data: kind,
          transient: true,
        });

        dataStream.write({
          type: "data-id",
          data: id,
          transient: true,
        });

        dataStream.write({
          type: "data-title",
          data: title,
          transient: true,
        });

        dataStream.write({
          type: "data-clear",
          data: null,
          transient: true,
        });

        const documentHandler = documentHandlersByArtifactKind.find(
          (documentHandlerByArtifactKind) =>
            documentHandlerByArtifactKind.kind === kind
        );

        if (!documentHandler) {
          throw new Error(`No document handler found for kind: ${kind}`);
        }

        await documentHandler.onCreateDocument({
          id,
          title,
          dataStream,
          session,
        });

        dataStream.write({ type: "data-finish", data: null, transient: true });

        createdDocument = { id, title, kind };
        createdDocumentIds.add(id);

        return {
          id,
          title,
          kind,
          content:
            "A document was created and is now visible to the user. Do NOT call viewDocument to verify it — viewDocument is only for user-referenced workspace documents, not for artifacts you just created.",
        };
      } finally {
        if (!createdDocument) {
          isCreating = false;
        }
      }
    },
  });
};
