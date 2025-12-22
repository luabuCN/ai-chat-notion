import { Editor, isTextSelection } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AiSelector,
  MathSelector,
  NodeSelector,
  TextAlignSelector,
  TextButtons,
} from "./selectors";

import { Separator } from "@repo/ui/separator";

export const DefaultBubbleMenu = ({
  editor,
  showAiTools,
}: {
  editor: Editor | null;
  showAiTools?: boolean;
}) => {
  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
      }}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        const { empty } = selection;

        if (!editor.isEditable) {
          return false;
        }

        if (empty) {
          return false;
        }

        if (!isTextSelection(selection)) {
          return false;
        }

        if (editor.isActive("codeBlock")) {
          return false;
        }

        return true;
      }}
    >
      <div className="flex w-fit max-w-[90vw] overflow-x-auto rounded-md border bg-popover shadow-xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex h-9 items-center shrink-0">
          {showAiTools && (
            <>
              <AiSelector editor={editor} />
              <Separator orientation="vertical" />
            </>
          )}
          <NodeSelector editor={editor} />
          <Separator orientation="vertical" />
          <MathSelector editor={editor} />
          <Separator orientation="vertical" />
          <TextButtons editor={editor} />
          <Separator orientation="vertical" />
          <TextAlignSelector editor={editor} />
        </div>
      </div>
    </BubbleMenu>
  );
};
