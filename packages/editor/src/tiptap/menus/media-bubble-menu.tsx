import { Button } from "@repo/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/dialog";
import { Input } from "@repo/ui/input";
import { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { LinkIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

export const MediaBubbleMenu = ({ editor }: { editor: Editor | null }) => {
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "attachment">("image");

  if (!editor) {
    return null;
  }

  const handleDelete = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const openReplaceDialog = () => {
    if (editor.isActive("image")) {
      setMediaType("image");
      setNewUrl(editor.getAttributes("image").src || "");
    } else if (editor.isActive("attachment")) {
      setMediaType("attachment");
      setNewUrl(editor.getAttributes("attachment").url || "");
    }
    setUrlDialogOpen(true);
  };

  const handleReplaceUrl = () => {
    if (!newUrl.trim()) return;

    if (mediaType === "image") {
      editor.chain().focus().setImage({ src: newUrl }).run();
    } else {
      const currentAttrs = editor.getAttributes("attachment");
      editor
        .chain()
        .focus()
        .deleteSelection()
        .setAttachment({
          url: newUrl,
          fileName:
            currentAttrs.fileName || newUrl.split("/").pop() || "attachment",
          fileSize: currentAttrs.fileSize,
          fileType: currentAttrs.fileType,
        })
        .run();
    }

    setUrlDialogOpen(false);
    setNewUrl("");
  };

  return (
    <>
      <BubbleMenu
        editor={editor}
        options={{
          placement: "top",
          offset: 8,
        }}
        shouldShow={({ editor }) => {
          return editor.isActive("image") || editor.isActive("attachment");
        }}
      >
        <div className="flex items-center gap-1 rounded-md border bg-popover p-1 shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={openReplaceDialog}
          >
            <LinkIcon className="size-4 mr-1" />
            Replace
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2Icon className="size-4 mr-1" />
            Delete
          </Button>
        </div>
      </BubbleMenu>

      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mediaType === "image" ? "Replace Image URL" : "Replace File URL"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Enter new URL..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleReplaceUrl();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReplaceUrl} disabled={!newUrl.trim()}>
                Replace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
