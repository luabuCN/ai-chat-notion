import { offset } from "@floating-ui/dom";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Placeholder } from "@tiptap/extensions";
import { Content, Editor, EditorContent, useEditor } from "@tiptap/react";
import { GripVerticalIcon, Plus } from "lucide-react";
import { useRef } from "react";
import { defaultExtensions } from "./tiptap/default-extensions";

import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { CodeBlockBubbleMenu } from "./tiptap/menus/codeblock-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import { TableOfContents } from "./components/table-of-contents";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";
import { useAIAutocomplete } from "./hooks/use-ai-autocomplete";
import { AIGhostOverlay } from "./ui/ai-ghost-overlay";
import type { AICompletionProvider } from "./tiptap/extensions/ai-autocomplete/types";

export interface TiptapEditorProps {
  content?: Content;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  className?: string;

  uploadFile?: (file: File) => Promise<string>;
  readonly?: boolean;

  /**
   * AI 补全提供者，用于 AI 自动补全功能
   */
  completionProvider?: AICompletionProvider;
}

export function TiptapEditor({
  content,
  placeholder,
  onCreate,
  onUpdate,
  className = "",

  uploadFile,
  readonly = false,
  completionProvider,
}: TiptapEditorProps) {
  // Use ref to store uploadFile to avoid editor recreation on every render
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  const stableUploadFile = useRef(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }).current;

  const editor = useEditor({
    editable: !readonly,
    extensions: [
      ...defaultExtensions,
      Placeholder.configure({
        placeholder: placeholder ?? "Type  /  for commands...",
        emptyEditorClass: "is-editor-empty text-gray-400",
        emptyNodeClass: "is-empty text-gray-400",
      }),

      SlashCommand.configure({
        suggestion: getSuggestion({
          uploadFile: uploadFile ? stableUploadFile : undefined,
        }),
      }),
    ],
    content: content,
    immediatelyRender: false, // 禁用立即渲染,避免 flushSync 警告
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        spellcheck: "false",
        class: "tiptap !pl-10",
      },
    },
    onCreate: ({ editor }) => {
      onCreate?.(editor);
    },
    onUpdate: ({ editor }) => {
      onUpdate?.(editor);
    },
    onContentError: ({ error }) => {
      console.error(error);
    },
  });

  const { handleSlashCommand } = useSlashCommandTrigger(editor);

  // AI 自动补全 Hook
  const { pendingCompletion, ghostPosition } = useAIAutocomplete({
    editor,
    completionProvider: completionProvider ?? {
      complete: async () => undefined,
      completion: "",
      isLoading: false,
    },
    options: { enabled: !!completionProvider },
  });

  if (readonly) {
    return (
      <div className={className}>
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert focus:outline-none max-w-full z-0"
        />
        <TableOfContents editor={editor} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {editor && (
        <>
          <DragHandle
            editor={editor}
            className="transition-all duration-300 ease-in-out"
            computePositionConfig={{
              middleware: [offset(20)],
            }}
          >
            <div className="flex items-center gap-1 -ml-2">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-pointer transition-colors border shadow-sm"
                onClick={handleSlashCommand}
              >
                <Plus className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex h-5 w-5 items-center justify-center rounded-sm bg-background hover:bg-muted cursor-grab transition-colors border shadow-sm">
                <GripVerticalIcon className="size-3.5 text-muted-foreground" />
              </div>
            </div>
          </DragHandle>
          <EditorContent
            editor={editor}
            className="prose dark:prose-invert focus:outline-none max-w-full z-0"
          />
          <TableHandle editor={editor} />
          <DefaultBubbleMenu editor={editor} />
          <MediaBubbleMenu editor={editor} />
          <CodeBlockBubbleMenu editor={editor} />
          <TableOfContents editor={editor} />
          {/* AI Ghost 文本覆盖层 */}
          {completionProvider && (
            <AIGhostOverlay text={pendingCompletion} position={ghostPosition} />
          )}
        </>
      )}
    </div>
  );
}

export type { Editor as TiptapEditorType } from "@tiptap/core";
