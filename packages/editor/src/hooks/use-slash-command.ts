import { Editor } from "@tiptap/react";
import type { MouseEvent } from "react";
import { useCallback } from "react";

export function useSlashCommandTrigger(editor: Editor | null) {
  const handleSlashCommand = useCallback(
    (e: MouseEvent) => {
      if (!editor) return;
      e.preventDefault();
      const buttonRect = e.currentTarget.getBoundingClientRect();
      const editorRect = editor.view.dom.getBoundingClientRect();

      // Use a position inside the editor content area (50px offset from left)
      const posInfo = editor.view.posAtCoords({
        left: editorRect.left + 50,
        top: buttonRect.top + buttonRect.height / 2,
      });

      if (!posInfo || posInfo.pos === undefined) return;

      const $pos = editor.state.doc.resolve(posInfo.pos);
      const isBlockEmpty = $pos.parent.content.size === 0;

      if (isBlockEmpty) {
        editor.chain().focus(posInfo.pos).run();
      } else {
        const endPos = $pos.end();
        editor.chain().focus(endPos).splitBlock().run();
      }
      // Insert the slash command trigger
      editor.commands.insertContent("/");
    },
    [editor]
  );

  return { handleSlashCommand };
}
