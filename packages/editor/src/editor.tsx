import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import "@blocknote/core/fonts/inter.css";
import { en, zh } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { en as aiEn, zh as aiZh } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";
import { DefaultChatTransport } from "ai";
import { useEffect, useState, useRef } from "react";

export interface NoteEditorProps {
  apiUrl?: string;
  locale?: string;
  theme?: "light" | "dark";
  uploadFile?: (file: File) => Promise<string>;
  onChange?: (value: string) => void;
  initialContent?: string;
}

export function NoteEditor({
  apiUrl = "/api/blocknote-ai",
  locale = "en",
  theme = "light",
  uploadFile,
  onChange,
  initialContent,
}: NoteEditorProps) {
  // Parse initial content if provided
  let parsedInitialContent: PartialBlock<any, any, any>[] = [{}];
  if (initialContent) {
    try {
      const parsed = JSON.parse(initialContent);
      // Ensure it's an array
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsedInitialContent = parsed as PartialBlock<any, any, any>[];
      }
    } catch {
      // If parsing fails, use default empty content
      parsedInitialContent = [{}];
    }
  }

  // Creates a new editor instance.
  const editor = useCreateBlockNote({
    dictionary:
      locale === "zh"
        ? {
            ...zh,
            ai: aiZh,
          }
        : {
            ...en,
            ai: aiEn,
          },
    // Register the AI extension
    extensions: [
      AIExtension({
        transport: new DefaultChatTransport({
          api: apiUrl,
        }),
      }),
    ],
    // Set initial content from props or use default
    initialContent: parsedInitialContent,
    uploadFile: uploadFile
      ? async (file: File) => {
          const url = await uploadFile(file);
          return url;
        }
      : undefined,
  });

  // Track the last initialContent that was set to avoid unnecessary updates
  const lastInitialContentRef = useRef<string | undefined>(initialContent);
  const isInitializedRef = useRef(!!initialContent);

  // Update editor content when initialContent changes from empty to having content
  useEffect(() => {
    // Skip if initialContent hasn't changed
    if (initialContent === lastInitialContentRef.current) {
      return;
    }

    // If we have initialContent and it's different from what's currently in the editor
    if (initialContent) {
      try {
        const parsed = JSON.parse(initialContent);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const currentContent = JSON.stringify(editor.document);

          // Only update if the content is actually different
          // This prevents overwriting user edits
          if (currentContent !== initialContent) {
            // Check if editor is empty (only has one empty block)
            const isEmpty =
              editor.document.length === 1 &&
              (!editor.document[0]?.content ||
                (Array.isArray(editor.document[0].content) &&
                  editor.document[0].content.length === 0));

            // Only update if editor is empty or this is the first initialization
            // This handles the case where initialContent loads after editor creation
            if (isEmpty || !isInitializedRef.current) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.replaceBlocks(editor.document, parsed as any);
              isInitializedRef.current = true;
            }
          }
        }
      } catch {
        // If parsing fails, ignore
      }
    }

    lastInitialContentRef.current = initialContent;
  }, [initialContent, editor]);

  useEffect(() => {
    if (onChange) {
      return editor.onChange(() => {
        onChange(JSON.stringify(editor.document));
      });
    }
  }, [editor, onChange]);

  // Renders the editor instance using a React component.
  return (
    <div>
      <BlockNoteView
        editor={editor}
        theme={theme}
        // We're disabling some default UI elements
        formattingToolbar={false}
        slashMenu={false}
      >
        {/* Add the AI Command menu to the editor */}
        <AIMenuController />

        {/* We disabled the default formatting toolbar with `formattingToolbar=false` 
        and replace it for one with an "AI button" (defined below). 
        (See "Formatting Toolbar" in docs)
        */}
        <FormattingToolbarWithAI editor={editor} />

        {/* We disabled the default SlashMenu with `slashMenu=false` 
        and replace it for one with an AI option (defined below). 
        (See "Suggestion Menus" in docs)
        */}
        <SuggestionMenuWithAI editor={editor} />
      </BlockNoteView>
    </div>
  );
}

// Formatting toolbar with the `AIToolbarButton` added
function FormattingToolbarWithAI(props: {
  editor: BlockNoteEditor<any, any, any>;
}) {
  const [hasMediaBlockSelected, setHasMediaBlockSelected] = useState(false);

  useEffect(() => {
    const updateSelection = () => {
      const selection = props.editor.getSelectionCutBlocks();
      if (selection) {
        const selectedBlocks = selection.blocks;
        const containsMediaBlock = selectedBlocks.some(
          (block) =>
            block.type === "image" ||
            block.type === "table" ||
            block.type === "video" ||
            block.type === "audio" ||
            block.type === "file"
        );
        setHasMediaBlockSelected(containsMediaBlock);
      } else {
        setHasMediaBlockSelected(false);
      }
    };

    // 监听选择变化
    const unsubscribe = props.editor.onSelectionChange(updateSelection);
    updateSelection(); // 初始检查

    return unsubscribe;
  }, [props.editor]);

  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          {...getFormattingToolbarItems()}
          {/* 只在非媒体块选择时显示AI按钮 */}
          {!hasMediaBlockSelected && <AIToolbarButton />}
        </FormattingToolbar>
      )}
    />
  );
}

// Slash menu with the AI option added
function SuggestionMenuWithAI(props: {
  editor: BlockNoteEditor<any, any, any>;
}) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(props.editor),
            // add the default AI slash menu items, or define your own
            ...getAISlashMenuItems(props.editor),
          ],
          query
        )
      }
    />
  );
}
