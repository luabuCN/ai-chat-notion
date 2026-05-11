import { Button } from "@repo/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Editor } from "@tiptap/core";
import { ImageIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import { useState } from "react";

interface UploadSelectorProps {
  editor: Editor;
  uploadFile?: (file: File) => Promise<string>;
}

export const UploadSelector = ({ editor, uploadFile }: UploadSelectorProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (!uploadFile) {
    return null;
  }

  const insertImagePlaceholder = () => {
    editor.chain().focus().setImageUploadPlaceholder().run();
    setPopoverOpen(false);
  };

  const insertAttachmentPlaceholder = () => {
    editor.chain().focus().setAttachmentUploadPlaceholder().run();
    setPopoverOpen(false);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-none h-9 px-2">
          <UploadIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1 shadow-xl" align="start" noPortal>
        <button
          type="button"
          onClick={() => insertImagePlaceholder()}
          className="flex w-full items-center text-sm rounded-md hover:bg-accent text-accent-foreground px-2 py-1.5 cursor-pointer text-left"
        >
          <ImageIcon className="size-3.5 me-2" />
          <span>Image</span>
        </button>
        <button
          type="button"
          onClick={() => insertAttachmentPlaceholder()}
          className="flex w-full items-center text-sm rounded-md hover:bg-accent text-accent-foreground px-2 py-1.5 cursor-pointer text-left"
        >
          <PaperclipIcon className="size-3.5 me-2" />
          <span>Attachment</span>
        </button>
      </PopoverContent>
    </Popover>
  );
};
