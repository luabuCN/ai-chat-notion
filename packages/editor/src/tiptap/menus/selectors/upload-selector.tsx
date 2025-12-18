import { Button } from "@repo/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { Editor } from "@tiptap/core";
import { ImageIcon, PaperclipIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { UploadDialog, UploadType } from "../../extensions/upload";

interface UploadSelectorProps {
  editor: Editor;
  uploadFile?: (file: File) => Promise<string>;
}

export const UploadSelector = ({ editor, uploadFile }: UploadSelectorProps) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadType, setUploadType] = useState<UploadType>("image");

  if (!uploadFile) {
    return null;
  }

  const openUploadDialog = (type: UploadType) => {
    setUploadType(type);
    setPopoverOpen(false);
    setUploadDialogOpen(true);
  };

  const handleInsert = (url: string, fileName?: string) => {
    if (uploadType === "image") {
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "paragraph",
          content: [
            {
              type: "text",
              marks: [{ type: "link", attrs: { href: url } }],
              text: fileName || "attachment",
            },
          ],
        })
        .run();
    }
    setUploadDialogOpen(false);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="rounded-none h-9 px-2">
            <UploadIcon className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1 shadow-xl" align="start" noPortal>
          <div
            onClick={() => openUploadDialog("image")}
            className="flex items-center text-sm rounded-md hover:bg-accent text-accent-foreground px-2 py-1.5 cursor-pointer"
          >
            <ImageIcon className="size-3.5 me-2" />
            <span>Image</span>
          </div>
          <div
            onClick={() => openUploadDialog("attachment")}
            className="flex items-center text-sm rounded-md hover:bg-accent text-accent-foreground px-2 py-1.5 cursor-pointer"
          >
            <PaperclipIcon className="size-3.5 me-2" />
            <span>Attachment</span>
          </div>
        </PopoverContent>
      </Popover>

      <UploadDialog
        isOpen={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        type={uploadType}
        uploadFile={uploadFile}
        onInsert={handleInsert}
      />
    </>
  );
};
