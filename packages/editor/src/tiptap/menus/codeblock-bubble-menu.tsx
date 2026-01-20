import { Editor, findParentNode } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { CodeBlockLanguageSelector } from "./selectors";
import { Button } from "@repo/ui/button";
import { CopyIcon, CheckIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { Separator } from "@repo/ui/separator";

export const CodeBlockBubbleMenu = ({ editor }: { editor: Editor | null }) => {
  const [copied, setCopied] = useState(false);
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

  const handleCopy = () => {
    const parentNode = findParentNode((node) => node.type.name === "codeBlock")(
      editor.state.selection
    );

    if (parentNode) {
      navigator.clipboard.writeText(parentNode.node.textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={() => editor.isActive("codeBlock")}
      getReferencedVirtualElement={() => {
        const parentNode = findParentNode(
          (node) => node.type.name === "codeBlock"
        )(editor.state.selection);
        if (parentNode) {
          // 获取代码块的实际 DOM 元素
          const domNode = editor.view.nodeDOM(parentNode.pos) as HTMLElement;
          if (domNode) {
            return domNode;
          }
        }
        return null;
      }}
      options={{
        placement: "top",
        offset: 8,
        flip: true,
        scrollTarget: scrollTarget || undefined,
      }}
    >
      <div className="flex w-fit max-w-[90vw] overflow-x-auto rounded-md border bg-popover shadow-xl overflow-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex h-9 items-center shrink-0">
          <CodeBlockLanguageSelector editor={editor} />
          <Separator orientation="vertical" />
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none h-9 px-3"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <CheckIcon className="size-3.5 me-2" />
                已复制
              </>
            ) : (
              <>
                <CopyIcon className="size-3.5 me-2" />
                复制
              </>
            )}
          </Button>
        </div>
      </div>
    </BubbleMenu>
  );
};
