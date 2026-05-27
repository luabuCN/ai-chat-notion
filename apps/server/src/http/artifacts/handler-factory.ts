import type { UIMessageStreamWriter } from "ai";
import type { AuthSession } from "../../shared/auth.js";
import type { ArtifactKind } from "../../shared/types.js";
import { saveDocument } from "@repo/database";
import type { Document } from "@repo/database";
import type { ChatMessage } from "../../shared/types.js";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: AuthSession;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: AuthSession;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  async function onCreateDocument(args: CreateDocumentCallbackProps) {
    const draftContent = await config.onCreateDocument({
      id: args.id,
      title: args.title,
      dataStream: args.dataStream,
      session: args.session,
    });

    if (args.session?.user?.id) {
      await saveDocument({
        id: args.id,
        title: args.title,
        content: draftContent,
        kind: config.kind,
        userId: args.session.user.id,
      });
    }
  }

  async function onUpdateDocument(args: UpdateDocumentCallbackProps) {
    const draftContent = await config.onUpdateDocument({
      document: args.document,
      description: args.description,
      dataStream: args.dataStream,
      session: args.session,
    });

    if (args.session?.user?.id) {
      await saveDocument({
        id: args.document.id,
        title: args.document.title,
        content: draftContent,
        kind: config.kind,
        userId: args.session.user.id,
      });
    }
  }

  return {
    kind: config.kind,
    onCreateDocument,
    onUpdateDocument,
  };
}
