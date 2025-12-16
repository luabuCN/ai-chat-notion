import { offset } from "@floating-ui/dom";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Placeholder } from "@tiptap/extensions";
import { Content, Editor, EditorContent, useEditor } from "@tiptap/react";
import { GripVerticalIcon } from "lucide-react";
import { toast } from "sonner";
import { defaultExtensions } from "./tiptap/default-extensions";
import { Ai } from "./tiptap/extensions/ai";
import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { TableHandle } from "./tiptap/menus/table-options-menu";

export interface TiptapEditorProps {
  content?: Content;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  className?: string;
  showAiTools?: boolean;
  aiApiUrl?: string;
}

export function TiptapEditor({
  content,
  placeholder,
  onCreate,
  onUpdate,
  className = "",
  showAiTools = true,
  aiApiUrl,
}: TiptapEditorProps) {
  const editor = useEditor({
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
        suggestion: getSuggestion({ ai: showAiTools }),
      }),
    ],
    content: content,
    immediatelyRender: true,
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

  return (
    <div className={className}>
      <DragHandle
        editor={editor}
        computePositionConfig={{
          middleware: [offset(20)],
        }}
      >
        <GripVerticalIcon className="text-muted-foreground" />
      </DragHandle>
      <EditorContent
        editor={editor}
        className="prose dark:prose-invert focus:outline-none max-w-full z-0"
      />
      <TableHandle editor={editor} />
      <DefaultBubbleMenu editor={editor} showAiTools={showAiTools} />
    </div>
  );
}

export type { Editor as TiptapEditorType } from "@tiptap/core";
