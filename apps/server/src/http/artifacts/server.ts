import { codeDocumentHandler } from "./code.js";
import { sheetDocumentHandler } from "./sheet.js";
import { textDocumentHandler } from "./text.js";
import type { DocumentHandler } from "./handler-factory.js";

export type {
  CreateDocumentCallbackProps,
  DocumentHandler,
  SaveDocumentProps,
  UpdateDocumentCallbackProps,
} from "./handler-factory.js";
export { createDocumentHandler } from "./handler-factory.js";

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
