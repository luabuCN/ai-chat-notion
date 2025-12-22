import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { cn } from "../../../lib/utils";
import { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  CheckIcon,
  CornerDownLeftIcon,
  ExternalLinkIcon,
  LinkIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef } from "react";

export const LinkSelector = ({ editor }: { editor: Editor }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isLink: instance.editor.isActive("link"),
      getLink: instance.editor.getAttributes("link").href,
      isMath: instance.editor.isActive("math"),
    }),
  });

  const handleSetLink = () => {
    const url = inputRef.current?.value;
    if (!url) {
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleOpenLink = () => {
    const url = editorState.getLink;
    if (url) {
      const isAbsolute = /^(?:[a-z+]+:)?\/\//i.test(url);
      const targetUrl = isAbsolute ? url : `https://${url}`;
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none shrink-0"
          disabled={editorState.isMath}
        >
          <LinkIcon
            className={cn("size-4", {
              "text-primary": editorState.isLink,
            })}
            strokeWidth={2.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full min-w-80 p-1"
        align="start"
        sideOffset={5}
      >
        <form
          className="flex items-center gap-0.5"
          onSubmit={(evt) => {
            evt.preventDefault();
            handleSetLink();
          }}
        >
          <Input
            ref={inputRef}
            placeholder="Paste a link..."
            defaultValue={editorState.getLink}
            className="h-8 flex-1 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent min-w-[200px]"
          />

          <Button
            variant="ghost"
            size="icon"
            type="submit"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            title="确认"
          >
            <CornerDownLeftIcon className="size-4" />
          </Button>

          {editorState.isLink && (
            <>
              <div className="h-4 w-px bg-border mx-1" />

              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={handleOpenLink}
                title="打开链接"
              >
                <ExternalLinkIcon className="size-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                type="button"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={handleRemoveLink}
                title="删除链接"
              >
                <Trash2Icon className="size-4" />
              </Button>
            </>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
};
