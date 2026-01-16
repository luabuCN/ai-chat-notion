import { offset } from "@floating-ui/dom";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Placeholder } from "@tiptap/extensions";
import { Content, Editor, EditorContent, useEditor } from "@tiptap/react";
import { GripVerticalIcon, Plus } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { defaultExtensions } from "./tiptap/default-extensions";
import { Ai } from "./tiptap/extensions/ai";
import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import { TableOfContents } from "./components/table-of-contents";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";

export interface TiptapEditorProps {
  content?: Content;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  className?: string;
  showAiTools?: boolean;
  aiApiUrl?: string;
  uploadFile?: (file: File) => Promise<string>;
  readonly?: boolean;
}

export function TiptapEditor({
  content,
  placeholder,
  onCreate,
  onUpdate,
  className = "",
  showAiTools = true,
  aiApiUrl,
  uploadFile,
  readonly = false,
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
      Ai.configure({
        apiUrl: aiApiUrl,
        onError: (error) => {
          console.error(error);
          toast.error("Error", {
            description: error.message,
          });
        },
      }),
      SlashCommand.configure({
        suggestion: getSuggestion({
          ai: showAiTools,
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
    <div className={className}>
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
          <DefaultBubbleMenu editor={editor} showAiTools={showAiTools} />
          <MediaBubbleMenu editor={editor} />
          <TableOfContents editor={editor} />
        </>
      )}
    </div>
  );
}

export type { Editor as TiptapEditorType } from "@tiptap/core";
