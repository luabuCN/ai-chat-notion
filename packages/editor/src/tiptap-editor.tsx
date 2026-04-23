import { Placeholder } from "@tiptap/extensions";
import { Content, Editor, EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePreviewControlled } from "@repo/ui";
import { toast } from "sonner";
import { defaultExtensions } from "./tiptap/default-extensions";
import { DocumentLink } from "./tiptap/extensions/document-link";
import { getSuggestion, SlashCommand } from "./tiptap/extensions/slash-command";
import {
  TIPTAP_IMAGE_PREVIEW_EVENT,
  type TiptapImagePreviewDetail,
} from "./tiptap/extensions/image/image";
import { DefaultBubbleMenu } from "./tiptap/menus/default-bubble-menu";
import { MediaBubbleMenu } from "./tiptap/menus/media-bubble-menu";
import { CodeBlockBubbleMenu } from "./tiptap/menus/codeblock-bubble-menu";
import { BlockDragHandleToolbar } from "./components/block-drag-handle-toolbar";
import AIPanel from "./components/ai-panel";
import { TableOfContents } from "./components/table-of-contents";
import { TableHandle } from "./tiptap/menus/table-options-menu";
import { useSlashCommandTrigger } from "./hooks/use-slash-command";

/** 监听图片预览自定义事件，用 PhotoSlider 受控模式展示全屏预览（避免 React 19 element.ref 报错） */
function ImagePreviewPortal() {
  const [state, setState] = useState<{ src: string; visible: boolean } | null>(
    null
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<TiptapImagePreviewDetail>).detail;
      setState({ src: detail.src, visible: true });
    };
    window.addEventListener(TIPTAP_IMAGE_PREVIEW_EVENT, handler);
    return () => window.removeEventListener(TIPTAP_IMAGE_PREVIEW_EVENT, handler);
  }, []);

  if (!state) return null;

  return (
    <ImagePreviewControlled
      src={state.src}
      visible={state.visible}
      onClose={() => setState(null)}
    />
  );
}

export interface TiptapEditorProps {
  content?: Content;
  contentVersion?: number;
  placeholder?: string;
  onCreate?: (editor: Editor) => void;
  onUpdate?: (editor: Editor) => void;
  className?: string;
  showAiTools?: boolean;
  aiApiUrl?: string; // Will use /api/ai/completion by default in AIPanel as per user request
  uploadFile?: (file: File) => Promise<string>;
  readonly?: boolean;
  /** SPA 跳转回调，用于文档链接点击。不传则退化为整页跳转 */
  navigate?: (href: string) => void;
}

export function TiptapEditor({
  content,
  contentVersion = 0,
  placeholder,
  onCreate,
  onUpdate,
  className = "",
  uploadFile,
  readonly = false,
  showAiTools = true,
  aiApiUrl,
  navigate,
}: TiptapEditorProps) {
  const uploadFileRef = useRef(uploadFile);
  uploadFileRef.current = uploadFile;

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const stableUploadFile = useRef(async (file: File) => {
    if (uploadFileRef.current) {
      return uploadFileRef.current(file);
    }
    throw new Error("Upload function not available");
  }).current;

  const stableNavigate = useRef((href: string) => {
    if (navigateRef.current) {
      navigateRef.current(href);
    } else {
      window.location.href = href;
    }
  }).current;

  const extensions = useMemo(() => {
    return [
      ...defaultExtensions,
      DocumentLink.configure({ navigate: stableNavigate }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type  /  for commands...",
        emptyEditorClass: "is-editor-empty text-gray-400",
        emptyNodeClass: "is-empty text-gray-400",
      }),
      SlashCommand.configure({
        suggestion: getSuggestion({
          ai: showAiTools,
          uploadFile: stableUploadFile,
        }),
      }),
    ];
  }, [placeholder, showAiTools]);

  const editor = useEditor({
    editable: !readonly,
    extensions,
    content: undefined,
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

  const appliedContentVersionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (appliedContentVersionRef.current === contentVersion) {
      return;
    }

    appliedContentVersionRef.current = contentVersion;

    const timer = setTimeout(() => {
      if (editor.isDestroyed) {
        return;
      }

      editor.commands.setContent(content ?? "", { emitUpdate: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [content, contentVersion, editor]);

  const { handleSlashCommand } = useSlashCommandTrigger(editor);

  if (readonly) {
    return (
      <div className={className}>
        <EditorContent
          editor={editor}
          className="prose dark:prose-invert focus:outline-none max-w-full z-0"
        />
        <TableOfContents editor={editor} />
        <ImagePreviewPortal />
      </div>
    );
  }

  return (
    <div className={className}>
      <ImagePreviewPortal />
      {editor && (
        <>
          <BlockDragHandleToolbar
            editor={editor}
            onAddClick={handleSlashCommand}
          />
          <EditorContent
            editor={editor}
            className="prose dark:prose-invert focus:outline-none max-w-full z-0"
          />
          <TableHandle editor={editor} />
          <DefaultBubbleMenu editor={editor} />
          <MediaBubbleMenu editor={editor} />
          <CodeBlockBubbleMenu editor={editor} />
          <TableOfContents editor={editor} />
          <AIPanel editor={editor} />
        </>
      )}
    </div>
  );
}

export type { Editor as TiptapEditorType } from "@tiptap/core";
