import { useState, useEffect } from "react";
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
import { useAIPanelStore } from "../../components/ai-panel/ai-panel-store";

export const DefaultBubbleMenu = ({ editor }: { editor: Editor | null }) => {
  const isVisible = useAIPanelStore((state) => state.isVisible);
  const isThinking = useAIPanelStore((state) => state.isThinking);
  const isStreaming = useAIPanelStore((state) => state.isStreaming);
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("editor-scroll-container");
    if (el) {
      setScrollTarget(el);
    }
  }, []);

  if (!editor) {
    return null;
  }

  // AI 面板可见或正在处理时，不渲染气泡菜单
  if (isVisible || isThinking || isStreaming) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
        scrollTarget: scrollTarget || undefined,
      }}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        const { empty } = selection;

        if (!editor.isEditable || isVisible || isThinking || isStreaming) {
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
          <AiSelector editor={editor} />
          <Separator orientation="vertical" className="mx-1 h-6" />
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
