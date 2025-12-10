import { BlockNoteEditor } from "@blocknote/core";
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
import { useEffect, useState } from "react";

export interface NoteEditorProps {
  apiUrl?: string;
  locale?: string;
  theme?: "light" | "dark";
  uploadFile?: (file: File) => Promise<string>;
  onChange?: (value: string) => void;
}

export function NoteEditor({
  apiUrl = "/api/blocknote-ai",
  locale = "en",
  theme = "light",
  uploadFile,
  onChange,
}: NoteEditorProps) {
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
    // We set some initial content for demo purposes
    initialContent: [{}],
    uploadFile: uploadFile
      ? async (file: File) => {
          const url = await uploadFile(file);
          return url;
        }
      : undefined,
  });

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
