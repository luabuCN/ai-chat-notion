// Tiptap Editor (new)
export * from "./tiptap-editor";
export * from "./collaborative-editor";
export * from "./tiptap/content-renderer";
export * from "./tiptap/default-extensions";
export * from "./hooks/use-editor-export";
export * from "./hooks/use-slash-command";
export * from "./hooks/use-ai-autocomplete";
export * from "./lib/markdown-converter";
export * from "./lib/user-utils";
export { AIGhostOverlay } from "./ui/ai-ghost-overlay";
export type {
  AICompletionProvider,
  AIAutocompleteOptions,
  GhostTextPosition,
} from "./tiptap/extensions/ai-autocomplete/types";
export type { Editor as TiptapEditorType } from "@tiptap/core";
