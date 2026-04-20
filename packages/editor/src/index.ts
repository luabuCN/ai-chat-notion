// Tiptap Editor (non-collaborative)
export * from "./tiptap-editor";

// Unified Editor (with collaboration support)
export {
  UnifiedEditor,
  type UnifiedEditorProps,
  type CollaborativeUser,
  type ConnectionStatus,
} from "./unified-editor";
export {
  EDITOR_SELECT_FROM_MATERIAL_LIBRARY,
  type MaterialLibrarySelectDetail,
} from "./tiptap/extensions/slash-command/suggestion";
export {
  DocumentLink,
  TIPTAP_INSERT_DOCUMENT_LINK,
  type InsertDocumentLinkDetail,
  type DocumentLinkOptions,
} from "./tiptap/extensions/document-link";
export * from "./tiptap/content-renderer";
export * from "./tiptap/default-extensions";
export * from "./hooks/use-editor-export";
export * from "./hooks/use-slash-command";
export * from "./lib/markdown-converter";
export * from "./lib/user-utils";
export type { Editor as TiptapEditorType } from "@tiptap/core";
